import { execFileSync } from "node:child_process";

import semver from "semver";

import {
  type FirstStableRequest,
  planVersion,
  type VersionPlan,
} from "./policy.js";

export function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trimEnd();
}

export interface ReleasePlan extends VersionPlan {
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly previousTag: string | null;
  readonly tag: string | null;
}

export async function readReleasePlan(
  root: string,
  sourceSha: string,
  firstStable: FirstStableRequest | null = null,
  resumeTag: string | null = null,
): Promise<ReleasePlan> {
  if (firstStable && firstStable.sourceSha !== sourceSha) {
    throw new Error("FIRST_STABLE_SHA_MISMATCH");
  }
  if (
    !/^[a-f0-9]{40}$/u.test(sourceSha) ||
    git(root, "rev-parse", `${sourceSha}^{commit}`) !== sourceSha
  ) {
    throw new Error("INVALID_SOURCE_SHA");
  }
  const tags = git(root, "tag", "--merged", sourceSha, "--list", "v*")
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const tag of tags) {
    if (semver.valid(tag.slice(1)) !== tag.slice(1)) {
      throw new Error(`INVALID_RELEASE_TAG: ${tag}`);
    }
  }
  tags.sort((a, b) => semver.rcompare(a.slice(1), b.slice(1)));
  const latestVersion = tags[0]?.slice(1);
  if (
    latestVersion &&
    (semver.prerelease(latestVersion) ||
      (semver.parse(latestVersion)?.build.length ?? 0) > 0)
  ) {
    throw new Error(
      "UNSUPPORTED_RELEASE_BASE: an explicit version migration is required",
    );
  }
  if (
    resumeTag &&
    (tags[0] !== resumeTag ||
      git(root, "rev-list", "-n", "1", resumeTag) !== sourceSha)
  ) {
    throw new Error("INVALID_RESUME_TAG");
  }
  const previousTag = tags.find((tag) => tag !== resumeTag) ?? null;
  if (
    previousTag &&
    git(root, "rev-list", "-n", "1", previousTag) === sourceSha &&
    !firstStable
  ) {
    return {
      previousVersion: previousTag.slice(1),
      version: null,
      firstStable: null,
      sourceSha,
      sourceTree: git(root, "rev-parse", `${sourceSha}^{tree}`),
      previousTag,
      tag: null,
    };
  }
  const messages = git(
    root,
    "log",
    "--format=%B%x00",
    previousTag ? `${previousTag}..${sourceSha}` : sourceSha,
  )
    .split("\0")
    .map((s) => s.trim())
    .filter(Boolean);
  const versionPlan = await planVersion({
    previousVersion: previousTag?.slice(1) ?? null,
    messages,
    firstStable,
  });
  if (resumeTag && `v${versionPlan.version}` !== resumeTag) {
    throw new Error("RESUME_VERSION_MISMATCH");
  }
  return {
    ...versionPlan,
    sourceSha,
    sourceTree: git(root, "rev-parse", `${sourceSha}^{tree}`),
    previousTag,
    tag: versionPlan.version ? `v${versionPlan.version}` : null,
  };
}

export function pushReleaseTag(
  root: string,
  remote: string,
  tag: string,
): void {
  if (!/^v\d+\.\d+\.\d+$/u.test(tag)) {
    throw new Error("INVALID_RELEASE_TAG");
  }
  git(root, "push", remote, `refs/tags/${tag}:refs/tags/${tag}`);
}
