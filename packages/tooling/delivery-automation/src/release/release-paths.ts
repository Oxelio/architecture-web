import { lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

function canonicalPath(candidate: string): string {
  let exists = true;
  try {
    lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    exists = false;
  }
  // A dangling link exists according to lstat, so realpath must fail closed.
  if (exists) {
    try {
      return realpathSync(candidate);
    } catch (error) {
      throw new Error("RELEASE_PATH_OUTSIDE_REPOSITORY", { cause: error });
    }
  }
  return join(canonicalPath(dirname(candidate)), basename(candidate));
}

export function confinedReleasePath(root: string, input: string): string {
  const base = realpathSync(root);
  const candidate = canonicalPath(resolve(base, input));
  const path = relative(base, candidate);
  if (path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error("RELEASE_PATH_OUTSIDE_REPOSITORY");
  }
  return candidate;
}

export function releaseAssetNames(version: unknown): readonly string[] {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/u.test(version)) {
    throw new Error("INVALID_RELEASE_VERSION");
  }
  return [
    `architecture-web-${version}-source.tar.gz`,
    "release-notes.md",
    "release-manifest.json",
    "SHA256SUMS",
  ];
}

function checkArtifacts(root: string, output: string, version: unknown): void {
  for (const name of releaseAssetNames(version)) {
    confinedReleasePath(root, join(output, name));
  }
}

export function prepareReleaseOutput(
  root: string,
  input: string,
  version: unknown,
): string {
  const output = confinedReleasePath(root, input);
  checkArtifacts(root, output, version);
  mkdirSync(output, { recursive: true });
  const created = confinedReleasePath(root, output);
  checkArtifacts(root, created, version);
  return created;
}

export function verifiedReleaseInput(root: string, input: string): string {
  const directory = confinedReleasePath(root, input);
  const manifest = JSON.parse(
    readFileSync(
      confinedReleasePath(root, join(directory, "release-manifest.json")),
      "utf8",
    ),
  ) as { plan?: { version?: unknown } };
  checkArtifacts(root, directory, manifest.plan?.version);
  return directory;
}
