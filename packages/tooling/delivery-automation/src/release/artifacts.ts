import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  globSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { c, x } from "tar";
import { parse } from "yaml";

import { releaseAssetNames } from "./release-paths.js";
import { git, type ReleasePlan } from "./repository.js";

const require = createRequire(import.meta.url);

function compareFileNames(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export interface ReleaseManifest {
  readonly schemaVersion: 1;
  readonly plan: ReleasePlan;
  readonly methodRevision: string | null;
  readonly transformations: readonly string[];
  readonly files: Readonly<Record<string, string>>;
}

export function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function workspaceManifests(root: string): string[] {
  const config = parse(
    readFileSync(join(root, "pnpm-workspace.yaml"), "utf8"),
  ) as { packages?: unknown };
  if (
    !Array.isArray(config.packages) ||
    !config.packages.every((p): p is string => typeof p === "string")
  ) {
    throw new Error("INVALID_WORKSPACE_CONFIGURATION");
  }
  const patterns = config.packages
    .filter((p) => !p.startsWith("!"))
    .map((p) => `${p}/package.json`);
  const exclude = [
    "**/node_modules/**",
    ...config.packages
      .filter((p) => p.startsWith("!"))
      .map((p) => `${p.slice(1)}/**`),
  ];
  const files = ["package.json", ...globSync(patterns, { cwd: root, exclude })]
    .map((p) => p.replaceAll("\\", "/"))
    .sort(compareFileNames);
  for (const file of files) {
    if (!lstatSync(join(root, file)).isFile()) {
      throw new Error("MANIFEST_MUST_BE_REGULAR_FILE");
    }
  }
  return [...new Set(files)];
}

export async function generateArtifacts(
  root: string,
  plan: ReleasePlan,
  output: string,
): Promise<ReleaseManifest> {
  if (!plan.version || !plan.tag) {
    throw new Error("NO_RELEASE_TO_GENERATE");
  }
  releaseAssetNames(plan.version);
  if (git(root, "rev-parse", "HEAD") !== plan.sourceSha) {
    throw new Error("CHECKOUT_MUST_MATCH_CANDIDATE");
  }
  const temporary = mkdtempSync(join(tmpdir(), "architecture-release-"));
  const stage = join(temporary, "source");
  mkdirSync(stage);
  mkdirSync(output, { recursive: true });
  try {
    const sourceTar = join(temporary, "source.tar");
    git(
      root,
      "archive",
      "--format=tar",
      `--output=${sourceTar}`,
      plan.sourceSha,
    );
    await x({ file: sourceTar, cwd: stage });
    const gitlink = git(
      root,
      "ls-tree",
      plan.sourceSha,
      "external/software-engineering-method",
    );
    const methodRevision = gitlink ? (gitlink.split(/\s+/u)[2] ?? null) : null;
    if (methodRevision) {
      const method = join(root, "external/software-engineering-method");
      if (git(method, "rev-parse", "HEAD") !== methodRevision) {
        throw new Error("METHOD_GITLINK_MISMATCH");
      }
      const methodTar = join(temporary, "method.tar");
      git(
        method,
        "archive",
        "--format=tar",
        `--output=${methodTar}`,
        methodRevision,
      );
      const destination = join(stage, "external/software-engineering-method");
      mkdirSync(destination, { recursive: true });
      await x({ file: methodTar, cwd: destination });
    }
    const manifests = workspaceManifests(stage);
    const date = git(root, "show", "-s", "--format=%cI", plan.sourceSha).slice(
      0,
      10,
    );
    const configuration = {
      ci: true,
      increment: plan.version,
      git: false,
      npm: false,
      github: false,
      gitlab: false,
      hooks: {},
      plugins: {
        [require.resolve("@release-it/conventional-changelog")]: {
          preset: {
            name: "conventionalcommits",
            types: [
              { type: "feat", section: "Features" },
              { type: "fix", section: "Fixes" },
              { type: "docs", section: "Documentation", effect: "changelog" },
            ],
          },
          infile: false,
          releaseCount: 0,
          writerOpts: { generateOn: null },
          gitRawCommitsOpts: {
            from: plan.previousTag ?? "",
            to: plan.sourceSha,
          },
          commitsOpts: { from: plan.previousTag ?? "", to: plan.sourceSha },
          context: {
            version: plan.version,
            currentTag: plan.tag,
            previousTag: plan.previousTag,
            date,
          },
        },
        [require.resolve("@release-it/bumper")]: {
          out: manifests.map((p) => join(stage, p).replaceAll("\\", "/")),
        },
      },
    };
    // Changelog readers infer boundaries from local tags. A retry must see the
    // same pre-publication tag set, without deleting anything in the source repo.
    const notesRepository = join(temporary, "notes-repository");
    git(root, "clone", "--shared", "--no-checkout", root, notesRepository);
    git(notesRepository, "checkout", "--detach", plan.sourceSha);
    git(
      notesRepository,
      "remote",
      "set-url",
      "origin",
      git(root, "remote", "get-url", "origin"),
    );
    if (git(notesRepository, "tag", "--list", plan.tag)) {
      git(notesRepository, "tag", "--delete", plan.tag);
    }
    const configPath = join(notesRepository, ".release-it-input.json");
    const resultPath = join(notesRepository, ".release-it-result.json");
    writeFileSync(configPath, JSON.stringify(configuration), { flag: "wx" });
    const compiledRunner = fileURLToPath(
      new URL("./release-it-runner.js", import.meta.url),
    );
    const runner = existsSync(compiledRunner)
      ? compiledRunner
      : compiledRunner.replace(/\.js$/u, ".ts");
    execFileSync(
      process.execPath,
      ["--import", pathToFileURL(require.resolve("tsx/esm")).href, runner],
      { cwd: notesRepository, stdio: "pipe" },
    );
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as {
      version: string;
      changelog: string;
    };
    if (result.version !== plan.version) {
      throw new Error("RELEASE_IT_VERSION_MISMATCH");
    }
    const notes = `${result.changelog.trim()}\n`;
    writeFileSync(join(stage, "CHANGELOG.md"), notes);
    writeFileSync(join(output, "release-notes.md"), notes);
    const archive = `architecture-web-${plan.version}-source.tar.gz`;
    await c(
      {
        cwd: stage,
        file: join(output, archive),
        gzip: true,
        portable: true,
        mtime: new Date(`${date}T00:00:00.000Z`),
        prefix: `architecture-web-${plan.version}/`,
      },
      readdirSync(stage).sort(compareFileNames),
    );
    const manifest: ReleaseManifest = {
      schemaVersion: 1,
      plan,
      methodRevision,
      transformations: [
        ...manifests.map((p) => `${p}:version=${plan.version}`),
        "CHANGELOG.md:generated-release-notes",
      ],
      files: {
        [archive]: sha256(join(output, archive)),
        "release-notes.md": sha256(join(output, "release-notes.md")),
      },
    };
    writeFileSync(
      join(output, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const names = [
      ...Object.keys(manifest.files),
      "release-manifest.json",
    ].sort(compareFileNames);
    writeFileSync(
      join(output, "SHA256SUMS"),
      names.map((name) => `${sha256(join(output, name))}  ${name}\n`).join(""),
    );
    return manifest;
  } finally {
    // Only remove the exact temporary directory allocated above, never an input path.
    rmSync(temporary, { recursive: true, force: true });
  }
}

export function readVerifiedArtifacts(directory: string): ReleaseManifest {
  const manifest = JSON.parse(
    readFileSync(join(directory, "release-manifest.json"), "utf8"),
  ) as ReleaseManifest;
  const version = manifest.plan?.version;
  if (
    manifest.schemaVersion !== 1 ||
    !version ||
    !/^\d+\.\d+\.\d+$/u.test(version) ||
    manifest.plan.tag !== `v${version}` ||
    !/^[a-f0-9]{40}$/u.test(manifest.plan.sourceSha)
  ) {
    throw new Error("INVALID_RELEASE_MANIFEST");
  }
  const expected = [
    `architecture-web-${version}-source.tar.gz`,
    "release-notes.md",
  ];
  if (
    JSON.stringify(Object.keys(manifest.files).toSorted(compareFileNames)) !==
    JSON.stringify(expected.toSorted(compareFileNames))
  ) {
    throw new Error("INVALID_RELEASE_ASSET_SET");
  }
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (
      dirname(name) !== "." ||
      relative(resolve(directory), resolve(directory, name)).startsWith("..") ||
      sha256(join(directory, name)) !== digest
    ) {
      throw new Error("RELEASE_ASSET_CHECKSUM_MISMATCH");
    }
  }
  const sums = [...expected, "release-manifest.json"]
    .sort(compareFileNames)
    .map((name) => `${sha256(join(directory, name))}  ${name}\n`)
    .join("");
  if (readFileSync(join(directory, "SHA256SUMS"), "utf8") !== sums) {
    throw new Error("RELEASE_CHECKSUMS_MISMATCH");
  }
  return manifest;
}
