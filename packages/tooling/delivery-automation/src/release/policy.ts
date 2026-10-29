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
    const breaking = commit.notes.length > 0;
    impact = Math.max(
      impact,
      breaking
        ? 3
        : commit["type"] === "feat"
          ? 2
          : commit["type"] === "fix"
            ? 1
            : 0,
    );
  }
  const bump =
    impact === 3 && previous && semver.major(previous) > 0
      ? "major"
      : impact >= 2
        ? "minor"
        : "patch";
  return {
    previousVersion: previous,
    version:
      impact === 0
        ? null
        : previous === null
          ? "0.1.0"
          : semver.inc(previous, bump),
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
