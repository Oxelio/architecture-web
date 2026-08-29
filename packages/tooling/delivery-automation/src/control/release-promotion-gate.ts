import type { EnforcementState } from "./work-merge-gate.js";

export type ReleasePromotionGateBlocker =
  | "RELEASE_WORK_UNAVAILABLE"
  | "CANDIDATE_UNAVAILABLE"
  | "BETA_EVIDENCE_INSUFFICIENT"
  | "HUMAN_RELEASE_APPROVAL_MISSING"
  | "HUMAN_RELEASE_APPROVAL_STALE"
  | "REPOSITORY_CHECKS_UNSATISFIED"
  | "RELEASE_BLOCKER_PRESENT"
  | "WORKING_DECISION_UNRESOLVED";

export interface ReleaseCandidateIdentity {
  readonly sourceRef: string;
  readonly sourceSha: string;
  readonly artifactIdentity: string | null;
}

export interface HumanReleaseApprovalEvidence {
  readonly exists: boolean;
  readonly approvedCandidate: ReleaseCandidateIdentity | null;
}

export interface ReleasePromotionGateEvidence {
  readonly releaseWorkIdentified: boolean;
  readonly candidate: ReleaseCandidateIdentity | null;
  readonly betaEvidenceSufficient: boolean;
  readonly humanReleaseApproval: HumanReleaseApprovalEvidence;
  readonly repositoryChecksSatisfied: boolean;
  readonly releaseBlockersResolved: boolean;
  readonly workingDecisionsResolved: boolean;
  readonly enforcement: EnforcementState;
}

export interface ReleasePromotionGateResult {
  readonly pass: boolean;
  readonly blockers: readonly ReleasePromotionGateBlocker[];
  readonly enforcement: EnforcementState;
  readonly grantsMergeAuthority: false;
  readonly executesHumanReleaseApproval: false;
}

function sameCandidate(
  current: ReleaseCandidateIdentity,
  approved: ReleaseCandidateIdentity,
): boolean {
  return (
    current.sourceRef === approved.sourceRef &&
    current.sourceSha === approved.sourceSha &&
    current.artifactIdentity === approved.artifactIdentity
  );
}

export function evaluateReleasePromotionGate(
  evidence: ReleasePromotionGateEvidence,
): ReleasePromotionGateResult {
  const blockers: ReleasePromotionGateBlocker[] = [];

  if (!evidence.releaseWorkIdentified) {
    blockers.push("RELEASE_WORK_UNAVAILABLE");
  }
  if (!evidence.candidate) {
    blockers.push("CANDIDATE_UNAVAILABLE");
  }
  if (!evidence.betaEvidenceSufficient) {
    blockers.push("BETA_EVIDENCE_INSUFFICIENT");
  }

  if (!evidence.humanReleaseApproval.exists) {
    blockers.push("HUMAN_RELEASE_APPROVAL_MISSING");
  } else if (
    evidence.candidate &&
    (!evidence.humanReleaseApproval.approvedCandidate ||
      !sameCandidate(
        evidence.candidate,
        evidence.humanReleaseApproval.approvedCandidate,
      ))
  ) {
    blockers.push("HUMAN_RELEASE_APPROVAL_STALE");
  }

  if (!evidence.repositoryChecksSatisfied) {
    blockers.push("REPOSITORY_CHECKS_UNSATISFIED");
  }
  if (!evidence.releaseBlockersResolved) {
    blockers.push("RELEASE_BLOCKER_PRESENT");
  }
  if (!evidence.workingDecisionsResolved) {
    blockers.push("WORKING_DECISION_UNRESOLVED");
  }

  return {
    pass: blockers.length === 0,
    blockers,
    enforcement: evidence.enforcement,
    grantsMergeAuthority: false,
    executesHumanReleaseApproval: false,
  };
}
