import type { WorkState } from "./eligibility.js";

export type EnforcementState = "active" | "unavailable";

export type WorkMergeGateBlocker =
  | "WORK_IDENTITY_UNAVAILABLE"
  | "WORK_NOT_VALIDATING"
  | "TASK_DISPOSITION_INCOMPLETE"
  | "DEPENDENCY_BLOCKED"
  | "REVIEW_NOT_ACCEPTED"
  | "VALIDATION_INSUFFICIENT"
  | "AUTHORITY_GATE_UNSATISFIED"
  | "WORKING_DECISION_UNRESOLVED"
  | "REPOSITORY_CHECKS_UNSATISFIED"
  | "PR_NOT_MERGEABLE";

export interface WorkMergeGateEvidence {
  readonly workIdentified: boolean;
  readonly workState: WorkState | null;
  readonly requiredTasksAcceptable: boolean;
  readonly dependenciesResolved: boolean;
  readonly applicableReviewsAccepted: boolean;
  readonly validationSufficient: boolean;
  readonly priorAuthorityGatesSatisfied: boolean;
  readonly workingDecisionsResolved: boolean;
  readonly repositoryChecksSatisfied: boolean;
  readonly pullRequestMergeable: boolean;
  readonly enforcement: EnforcementState;
}

export interface WorkMergeGateResult {
  readonly pass: boolean;
  readonly blockers: readonly WorkMergeGateBlocker[];
  readonly enforcement: EnforcementState;
  readonly grantsMergeAuthority: false;
  readonly impliesDone: false;
}

export function evaluateWorkMergeGate(
  evidence: WorkMergeGateEvidence,
): WorkMergeGateResult {
  const blockers: WorkMergeGateBlocker[] = [];

  if (!evidence.workIdentified) {
    blockers.push("WORK_IDENTITY_UNAVAILABLE");
  }
  if (evidence.workState !== "Validating") {
    blockers.push("WORK_NOT_VALIDATING");
  }
  if (!evidence.requiredTasksAcceptable) {
    blockers.push("TASK_DISPOSITION_INCOMPLETE");
  }
  if (!evidence.dependenciesResolved) {
    blockers.push("DEPENDENCY_BLOCKED");
  }
  if (!evidence.applicableReviewsAccepted) {
    blockers.push("REVIEW_NOT_ACCEPTED");
  }
  if (!evidence.validationSufficient) {
    blockers.push("VALIDATION_INSUFFICIENT");
  }
  if (!evidence.priorAuthorityGatesSatisfied) {
    blockers.push("AUTHORITY_GATE_UNSATISFIED");
  }
  if (!evidence.workingDecisionsResolved) {
    blockers.push("WORKING_DECISION_UNRESOLVED");
  }
  if (!evidence.repositoryChecksSatisfied) {
    blockers.push("REPOSITORY_CHECKS_UNSATISFIED");
  }
  if (!evidence.pullRequestMergeable) {
    blockers.push("PR_NOT_MERGEABLE");
  }

  return {
    pass: blockers.length === 0,
    blockers,
    enforcement: evidence.enforcement,
    grantsMergeAuthority: false,
    impliesDone: false,
  };
}
