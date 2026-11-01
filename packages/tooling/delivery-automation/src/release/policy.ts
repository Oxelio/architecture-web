import createPreset from "conventional-changelog-conventionalcommits";
import { CommitParser } from "conventional-commits-parser";
import semver from "semver";

export interface FirstStableRequest {
  readonly actor: string;
  readonly runId: string;
  readonly sourceSha: string;
}

export interface VersionPlan {
  readonly previousVersion: string | null;
  readonly version: string | null;
  readonly firstStable: FirstStableRequest | null;
}

function commitImpact(commit: ReturnType<CommitParser["parse"]>): number {
  if (commit.notes.length > 0) {
    return 3;
  }
  if (commit["type"] === "feat") {
    return 2;
  }
  return commit["type"] === "fix" ? 1 : 0;
}

function nextVersion(previous: string | null, impact: number): string | null {
  if (impact === 0) {
    return null;
  }
  if (previous === null) {
    return "0.1.0";
  }
  if (impact === 3 && semver.major(previous) > 0) {
    return semver.inc(previous, "major");
  }
  return semver.inc(previous, impact >= 2 ? "minor" : "patch");
}

export async function planVersion(input: {
  readonly previousVersion: string | null;
  readonly messages: readonly string[];
  readonly firstStable?: FirstStableRequest | null;
}): Promise<VersionPlan> {
  const previous = input.previousVersion;
  if (
    previous !== null &&
    (semver.valid(previous) !== previous ||
      semver.prerelease(previous) ||
      (semver.parse(previous)?.build.length ?? 0) > 0)
  ) {
    throw new Error(
      "UNSUPPORTED_RELEASE_BASE: an explicit version migration is required",
    );
  }
  const request = input.firstStable ?? null;
  if (request) {
    if (
      (previous && semver.gte(previous, "1.0.0")) ||
      !request.actor ||
      !/^\d+$/u.test(request.runId) ||
      !/^[a-f0-9]{40}$/u.test(request.sourceSha)
    ) {
      throw new Error("INVALID_FIRST_STABLE_REQUEST");
    }
    return {
      previousVersion: previous,
      version: "1.0.0",
      firstStable: request,
    };
  }
  const preset = (await createPreset()) as {
    parser: ConstructorParameters<typeof CommitParser>[0];
  };
  const parser = new CommitParser(preset.parser);
  let impact = 0;
  for (const message of input.messages) {
    const commit = parser.parse(message);
    impact = Math.max(impact, commitImpact(commit));
  }
  return {
    previousVersion: previous,
    version: nextVersion(previous, impact),
    firstStable: null,
  };
}

export function assertPublicationContext(input: {
  readonly ref: string;
  readonly event: string;
}): void {
  if (
    input.ref !== "refs/heads/main" ||
    !["push", "workflow_dispatch"].includes(input.event)
  ) {
    throw new Error("PUBLICATION_REQUIRES_MAIN");
  }
}
