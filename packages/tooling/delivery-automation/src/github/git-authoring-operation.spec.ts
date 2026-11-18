import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";

import { afterEach, expect, it } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import {
  inspectAuthoringGitBundle,
  resolveGitAuthoringOperation,
} from "./git-authoring-operation.js";

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const path = relative(tmpdir(), directory);
    if (
      !path ||
      isAbsolute(path) ||
      path.startsWith("..") ||
      !path.startsWith("authoring-git-fixture-")
    ) {
      throw new Error("Unsafe fixture cleanup");
    }
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "authoring-git-fixture-"));
  directories.push(directory);
  const source = join(directory, "source");
  const staging = join(directory, "staging");
  await mkdir(source);
  await mkdir(staging);
  const git = async (...args: string[]) => {
    const result = await execute(
      "git",
      [
        "-c",
        "core.hooksPath=",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "-c",
        "commit.gpgSign=false",
        "-C",
        source,
        ...args,
      ],
      {
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
        windowsHide: true,
      },
    );
    return result.stdout.trim();
  };
  await git("init", "--initial-branch=codex/fixture");
  await mkdir(join(source, "docs", "project"), { recursive: true });
  await writeFile(join(source, "docs", "project", "policy.md"), "base\n");
  await git("add", ".");
  await git("commit", "-m", "fixture base");
  const base = await git("rev-parse", "HEAD");
  const pack = async (expectedHeadSha: string | null) => {
    const proposedHeadSha = await git("rev-parse", "HEAD");
    const packing = execute(
      "git",
      ["-C", source, "pack-objects", "--all", "--stdout"],
      { encoding: "buffer", windowsHide: true },
    );
    packing.child.stdin?.end();
    const result = await packing;
    const payload = Buffer.concat([
      Buffer.from(
        `# v2 git bundle\n${proposedHeadSha} refs/heads/codex/fixture\n\n`,
      ),
      result.stdout,
    ]);
    const request = prepareAuthoringRequest({
      authenticatedSubject: "fixture",
      envelope: {
        schema: 1,
        repositoryId: 1336937640,
        workNumber: 140,
        clientKey: "11111111-1111-4111-8111-111111111111",
        command: {
          kind: "publish-commit",
          sourceRef: "refs/heads/codex/fixture",
          expectedHeadSha,
          proposedHeadSha,
          payloadDigest: createHash("sha256").update(payload).digest("hex"),
        },
      },
    });
    if (!request) {
      throw new Error("Invalid fixture request");
    }
    return {
      request,
      payload,
      sourceBaseSha: base,
      stagingDirectory: staging,
      maximumCommits: 20,
    };
  };
  return { directory, source, staging, base, git, pack };
}

it(
  "inspects real Git objects, including protected changes reverted before the tip",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    await writeFile(
      join(f.source, "docs", "project", "policy.md"),
      "transient change\n",
    );
    await f.git("add", ".");
    await f.git("commit", "-m", "fixture transient policy change");
    await writeFile(join(f.source, "docs", "project", "policy.md"), "base\n");
    await writeFile(
      join(f.source, "application.ts"),
      "export const fixture = true;\n",
    );
    await f.git("add", ".");
    await f.git("commit", "-m", "fixture final application change");
    const input = await f.pack(f.base);
    const inventory = await inspectAuthoringGitBundle(input);
    expect(inventory.fastForward).toBe(true);
    expect(inventory.commits).toHaveLength(2);
    expect(inventory.paths).toEqual([
      "application.ts",
      "docs/project/policy.md",
    ]);
    expect(await readdir(f.staging)).toEqual([]);
    expect(
      await resolveGitAuthoringOperation({
        ...input,
        authoringToken: "synthetic",
        scope: {
          repositoryId: 1336937640,
          kind: "publish-commit",
          affectedWorks: [140],
          affectedPulls: [],
          affectedRefs: ["refs/heads/codex/fixture"],
        },
        reserved: null,
        inventoryComplete: true,
        authorityDigest: "a".repeat(64),
        readAuthority: async () => "a".repeat(64),
        verifyInventory: async () => false,
      }),
    ).toBeNull();
  },
);

it(
  "includes paths removed by a non-fast-forward proposal instead of approving it implicitly",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    await writeFile(join(f.source, "prior-only.ts"), "prior\n");
    await f.git("add", ".");
    await f.git("commit", "-m", "fixture prior source head");
    const oldHead = await f.git("rev-parse", "HEAD");
    await f.git("branch", "retained-old", oldHead);
    await f.git("switch", "--force-create", "codex/fixture", f.base);
    await writeFile(join(f.source, "new-only.ts"), "proposed\n");
    await f.git("add", ".");
    await f.git("commit", "-m", "fixture replacement source head");
    const inventory = await inspectAuthoringGitBundle(await f.pack(oldHead));
    expect(inventory.fastForward).toBe(false);
    expect(inventory.paths).toEqual(["new-only.ts", "prior-only.ts"]);
    expect(await readdir(f.staging)).toEqual([]);
  },
);

it(
  "supports expected absence for branch creation and rejects changed bundle bytes",
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    const input = await f.pack(null);
    expect(await inspectAuthoringGitBundle(input)).toMatchObject({
      expectedHeadSha: null,
      paths: [],
      commits: [],
    });
    await expect(
      inspectAuthoringGitBundle({ ...input, payload: Buffer.from("changed") }),
    ).rejects.toThrow("AUTHORING_BUNDLE_INVALID");
    expect(await readdir(f.staging)).toEqual([]);
  },
);
