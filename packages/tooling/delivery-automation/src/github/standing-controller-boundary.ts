import { isDeepStrictEqual } from "node:util";

import { sameWorkIntegrationCandidate } from "../control/work-integration-request.js";
import type {
  MergeCandidate,
  StandingEvidenceAuthority,
  StandingRulesetObservation,
} from "./work-merge-publisher.js";

const sha = /^[0-9a-f]{40}$/u;
const statusWriterKinds = [
  "project-state",
  "tasks-dependencies",
  "review-decision-records",
  "pr-head-base",
  "gate-issuer",
  "journal-refs",
  "delegation",
] as const;

export interface StandingControllerBoundary {
  readonly kind: "standing-work-controller-boundary";
  readonly mode: "supervised" | "standing";
  readonly candidate?: MergeCandidate;
  readonly expiresAt?: string;
  readonly repositoryId: number;
  readonly projectId: string;
  readonly controllerInstallationId: number;
  readonly checksInstallationId: number;
  readonly sources: Readonly<Record<string, string>>;
  readonly freshnessPolicy: "final-observation";
  readonly validatedWriters?: readonly string[];
  readonly validationRef: string;
  readonly journalCreationRulesetId: number;
  readonly journalImmutabilityRulesetId: number;
  readonly mergeRulesetId: number;
  readonly rulesetObservations: readonly StandingRulesetObservation[];
  readonly evidenceAuthority: StandingEvidenceAuthority;
}

// Accept only an attributable activation record describing the tested
// deployment. Candidate evidence and live rulesets are checked separately.
export function matchesStandingControllerBoundary(
  value: StandingControllerBoundary | null,
  expected: Pick<
    StandingControllerBoundary,
    | "repositoryId"
    | "projectId"
    | "controllerInstallationId"
    | "checksInstallationId"
    | "sources"
  >,
  use: {
    readonly mode: StandingControllerBoundary["mode"];
    readonly candidate?: MergeCandidate;
    readonly now: number;
    readonly requireWriterExclusion?: true;
  },
): value is StandingControllerBoundary {
  if (
    value?.kind !== "standing-work-controller-boundary" ||
    value.mode !== use.mode ||
    value.repositoryId !== expected.repositoryId ||
    value.projectId !== expected.projectId ||
    value.controllerInstallationId !== expected.controllerInstallationId ||
    value.checksInstallationId !== expected.checksInstallationId ||
    Object.values(expected.sources).some((oid) => !sha.test(oid)) ||
    !isDeepStrictEqual(value.sources, expected.sources) ||
    value.freshnessPolicy !== "final-observation" ||
    !/^https:\/\/github\.com\/Oxelio\/architecture-web\/actions\/runs\/[1-9]\d*$/u.test(
      value.validationRef,
    )
  ) {
    return false;
  }

  if (
    use.mode === "supervised" &&
    (!value.candidate ||
      !use.candidate ||
      !sameWorkIntegrationCandidate(value.candidate, use.candidate) ||
      Number.isNaN(Date.parse(value.expiresAt ?? "")) ||
      Date.parse(value.expiresAt ?? "") <= use.now)
  ) {
    return false;
  }

  if (use.requireWriterExclusion) {
    const writers = value.validatedWriters;
    if (
      !Array.isArray(writers) ||
      writers.length !== statusWriterKinds.length ||
      !statusWriterKinds.every((writer) => writers.includes(writer))
    ) {
      return false;
    }
  }

  const rulesetIds = [
    value.journalCreationRulesetId,
    value.journalImmutabilityRulesetId,
    value.mergeRulesetId,
  ];
  return (
    rulesetIds.every((id) => Number.isSafeInteger(id) && id > 0) &&
    new Set(rulesetIds).size === 3 &&
    Array.isArray(value.rulesetObservations) &&
    !!value.evidenceAuthority &&
    typeof value.evidenceAuthority === "object"
  );
}
