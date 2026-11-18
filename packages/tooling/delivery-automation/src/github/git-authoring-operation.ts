import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import {
  type ControlledWriteScope,
  isControlledBranchRef,
  type ReservedWriteContext,
} from "../control/controlled-write.js";
import type { ResolvedAuthoringOperation } from "./controlled-authoring-execution.js";

const execute = promisify(execFile);
const remote = "https://github.com/Oxelio/architecture-web.git";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

class AuthoringGitCommandError extends Error {
  constructor(readonly exitCode: number | null) {
    super("AUTHORING_GIT_COMMAND_UNVERIFIED");
  }
}

export interface AuthoringGitInventory {
  readonly sourceRef: string;
  readonly expectedHeadSha: string | null;
  readonly proposedHeadSha: string;
  readonly sourceBaseSha: string;
  readonly treeSha: string;
  readonly commits: readonly string[];
  readonly paths: readonly string[];
  readonly fastForward: boolean;
}

interface BundleInput {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly sourceBaseSha: string;
  readonly stagingDirectory: string;
  readonly maximumCommits: number;
}

function gitEnvironment(token?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const name of ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    if (process.env[name]) {
      env[name] = process.env[name];
    }
  }
  Object.assign(env, {
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_PROTOCOL_FROM_USER: "0",
  });
  if (token) {
    Object.assign(env, {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
    });
  }
  return env;
}

async function git(directory: string, args: readonly string[], token?: string) {
  try {
    const result = await execute(
      "git",
      [
        "-c",
        `core.hooksPath=${join(directory, "empty-hooks")}`,
        "-c",
        "core.fsmonitor=false",
        "-c",
        "credential.helper=",
        "-c",
        "protocol.allow=never",
        "-c",
        "protocol.https.allow=always",
        "-c",
        "fetch.fsckObjects=true",
        "-c",
        "receive.fsckObjects=true",
        ...args,
      ],
      {
        cwd: directory,
        env: { ...gitEnvironment(token), GIT_CEILING_DIRECTORIES: directory },
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
        encoding: "buffer",
      },
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(result.stdout);
  } catch (error) {
    // Child errors may contain provider diagnostics. Do not propagate them or
    // attach command/environment/credential values to the public result.
    const failure = error as { code?: unknown; killed?: boolean };
    throw new AuthoringGitCommandError(
      !failure.killed && typeof failure.code === "number" ? failure.code : null,
    );
  }
}

function ensureInput(input: BundleInput) {
  if (
    input.request.command.kind !== "publish-commit" ||
    !/^[a-f0-9]{40}$/u.test(input.sourceBaseSha) ||
    !isAbsolute(input.stagingDirectory) ||
    !Number.isSafeInteger(input.maximumCommits) ||
    input.maximumCommits < 1 ||
    createHash("sha256").update(input.payload).digest("hex") !==
      input.request.command.payloadDigest
  ) {
    throw new Error("AUTHORING_BUNDLE_INVALID");
  }
  return input.request.command;
}

async function withBundle<T>(
  input: BundleInput,
  use: (directory: string, inventory: AuthoringGitInventory) => Promise<T>,
): Promise<T> {
  const command = ensureInput(input);
  await mkdir(input.stagingDirectory, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(
    join(input.stagingDirectory, "git-authoring-"),
  );
  try {
    await mkdir(join(directory, "empty-hooks"));
    await git(directory, [
      "init",
      "--bare",
      "--template=empty-hooks",
      "repository.git",
    ]);
    const repository = join(directory, "repository.git");
    const bundle = join(directory, "source.bundle");
    await writeFile(bundle, input.payload, { flag: "wx", mode: 0o600 });
    const run = (args: readonly string[]) =>
      git(directory, ["--git-dir", repository, ...args]);
    await unpackBundle(run, bundle, command, input.sourceBaseSha);
    const inventory = await readBundleInventory(run, input, command);
    return await use(directory, inventory);
  } finally {
    await disposeBundle(input.stagingDirectory, directory);
  }
}

async function disposeBundle(parent: string, directory: string) {
  const child = relative(parent, directory);
  if (!child || isAbsolute(child) || child.startsWith("..")) {
    throw new Error("AUTHORING_CLEANUP_PATH_UNVERIFIED");
  }
  await rm(directory, { recursive: true, force: true });
}

type GitRead = (args: readonly string[]) => Promise<string>;
type PublicationCommand = Extract<
  PreparedAuthoringRequest["command"],
  { kind: "publish-commit" }
>;

async function fetchCanonicalObject(run: GitRead, sha: string) {
  await run([
    "fetch",
    "--no-tags",
    "--no-recurse-submodules",
    "--depth=1",
    remote,
    sha,
  ]);
}

async function unpackBundle(
  run: GitRead,
  bundle: string,
  command: PublicationCommand,
  sourceBaseSha: string,
) {
  const bases = [
    ...new Set(
      [sourceBaseSha, command.expectedHeadSha].filter(
        (value): value is string => value !== null,
      ),
    ),
  ];
  const heads = (await run(["bundle", "list-heads", bundle]))
    .trim()
    .split(/\r?\n/u);
  if (
    heads.length !== 1 ||
    heads[0] !== `${command.proposedHeadSha} ${command.sourceRef}`
  ) {
    throw new Error("AUTHORING_BUNDLE_HEAD_UNVERIFIED");
  }
  try {
    await run(["bundle", "verify", bundle]);
  } catch {
    // Fetch only canonical base objects from the fixed public repository.
    // This read has no write credential and never follows submodules.
    for (const base of bases) {
      await fetchCanonicalObject(run, base);
    }
    await run(["bundle", "verify", bundle]);
  }
  await run(["bundle", "unbundle", bundle]);
  for (const base of bases) {
    try {
      await run(["cat-file", "-e", `${base}^{commit}`]);
    } catch {
      await fetchCanonicalObject(run, base);
    }
  }
}

async function readChangedPaths(
  run: GitRead,
  command: PublicationCommand,
  sourceBaseSha: string,
  commits: readonly string[],
) {
  const paths = new Set<string>();
  const finalDelta = await run([
    "diff-tree",
    "-r",
    "--no-commit-id",
    "--name-only",
    "--no-renames",
    "--no-ext-diff",
    "--no-textconv",
    "-z",
    command.expectedHeadSha ?? sourceBaseSha,
    command.proposedHeadSha,
  ]);
  for (const path of finalDelta.split("\0").filter(Boolean)) {
    paths.add(path);
  }
  for (const commit of commits) {
    if (!/^[a-f0-9]{40}$/u.test(commit)) {
      throw new Error("AUTHORING_COMMIT_UNVERIFIED");
    }
    const changed = await run([
      "diff-tree",
      "--root",
      "-r",
      "-m",
      "--no-commit-id",
      "--name-only",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "-z",
      commit,
    ]);
    for (const path of changed.split("\0").filter(Boolean)) {
      paths.add(path);
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

async function readBundleInventory(
  run: GitRead,
  input: BundleInput,
  command: PublicationCommand,
): Promise<AuthoringGitInventory> {
  await run([
    "fsck",
    "--strict",
    "--connectivity-only",
    "--no-reflogs",
    command.proposedHeadSha,
  ]);
  await run([
    "merge-base",
    "--is-ancestor",
    input.sourceBaseSha,
    command.proposedHeadSha,
  ]);
  const commits = (
    await run([
      "rev-list",
      "--reverse",
      "--topo-order",
      `${command.expectedHeadSha ?? input.sourceBaseSha}..${command.proposedHeadSha}`,
    ])
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (commits.length > input.maximumCommits) {
    throw new Error("AUTHORING_COMMIT_LIMIT");
  }
  const paths = await readChangedPaths(
    run,
    command,
    input.sourceBaseSha,
    commits,
  );
  let fastForward = command.expectedHeadSha === null;
  if (command.expectedHeadSha) {
    try {
      await run([
        "merge-base",
        "--is-ancestor",
        command.expectedHeadSha,
        command.proposedHeadSha,
      ]);
      fastForward = true;
    } catch (error) {
      if (
        !(error instanceof AuthoringGitCommandError) ||
        error.exitCode !== 1
      ) {
        throw error;
      }
      fastForward = false;
    }
  }
  const treeSha = (
    await run(["rev-parse", `${command.proposedHeadSha}^{tree}`])
  ).trim();
  if (!/^[a-f0-9]{40}$/u.test(treeSha)) {
    throw new Error("AUTHORING_TREE_UNVERIFIED");
  }
  return {
    ...command,
    sourceBaseSha: input.sourceBaseSha,
    treeSha,
    commits,
    paths,
    fastForward,
  };
}

export function inspectAuthoringGitBundle(input: BundleInput) {
  return withBundle(input, async (_directory, inventory) => inventory);
}

export async function readAuthoringRemoteHead(
  sourceRef: string,
  stagingDirectory: string,
) {
  // Source refs are validated in the prepared command; also guard standalone
  // observation against option injection. Never accept a remote from a caller.
  if (!isControlledBranchRef(sourceRef) || !isAbsolute(stagingDirectory)) {
    throw new Error("AUTHORING_REF_UNVERIFIED");
  }
  const result = (
    await git(stagingDirectory, ["ls-remote", "--refs", remote, sourceRef])
  ).trim();
  if (!result) {
    return null;
  }
  const [head, ref, extra] = result.split(/\s+/u);
  if (!head || !/^[a-f0-9]{40}$/u.test(head) || ref !== sourceRef || extra) {
    throw new Error("AUTHORING_REF_UNVERIFIED");
  }
  return head;
}

export async function resolveGitAuthoringOperation(
  input: BundleInput & {
    readonly authoringToken: string;
    readonly scope: ControlledWriteScope;
    readonly reserved: ReservedWriteContext | null;
    readonly inventoryComplete: boolean;
    readonly authorityDigest: string;
    readonly readAuthority: () => Promise<string | null>;
    readonly verifyInventory: (
      inventory: AuthoringGitInventory,
    ) => Promise<boolean>;
    // Set only from the existing Work/Role authorization, never the agent's
    // envelope. A transport lease alone does not authorize a history rewrite.
    readonly allowNonFastForward?: boolean;
  },
): Promise<ResolvedAuthoringOperation | null> {
  const command = ensureInput(input);
  if (!input.authoringToken) {
    return null;
  }
  const inventory = await inspectAuthoringGitBundle(input);
  if (
    (!inventory.fastForward && input.allowNonFastForward !== true) ||
    !(await input.verifyInventory(inventory))
  ) {
    return null;
  }
  const isCurrent = async () =>
    (await readAuthoringRemoteHead(
      command.sourceRef,
      input.stagingDirectory,
    )) === command.expectedHeadSha && (await input.verifyInventory(inventory));
  return {
    scope: input.scope,
    reserved: input.reserved,
    inventoryComplete: input.inventoryComplete,
    authorityDigest: input.authorityDigest,
    readAuthority: input.readAuthority,
    isCurrent,
    perform: (authorize) =>
      withBundle(input, async (directory, current) => {
        if (
          digest(current) !== digest(inventory) ||
          !(await isCurrent()) ||
          !(await authorize())
        ) {
          return {
            outcome: "known-unstarted",
            proofDigest: digest([
              "git-handoff-not-started",
              input.request.requestId,
              inventory,
            ]),
          };
        }
        await git(
          directory,
          [
            "--git-dir",
            join(directory, "repository.git"),
            "push",
            "--porcelain",
            "--no-follow-tags",
            `--force-with-lease=${command.sourceRef}:${command.expectedHeadSha ?? ""}`,
            remote,
            `${command.proposedHeadSha}:${command.sourceRef}`,
          ],
          input.authoringToken,
        );
        return (await readAuthoringRemoteHead(
          command.sourceRef,
          input.stagingDirectory,
        )) === command.proposedHeadSha
          ? {
              outcome: "confirmed",
              proofDigest: digest([
                "git-ref-applied",
                input.request.requestId,
                command.sourceRef,
                command.proposedHeadSha,
              ]),
            }
          : null;
      }),
  };
}
