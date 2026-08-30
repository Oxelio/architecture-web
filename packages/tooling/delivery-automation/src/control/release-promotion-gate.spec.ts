import { describe, expect, it } from "vitest";

import {
  evaluateReleasePromotionGate,
  type ReleaseCandidateIdentity,
  type ReleasePromotionGateEvidence,
} from "./release-promotion-gate.js";

const candidate: ReleaseCandidateIdentity = {
  sourceRef: "release/1.0.0",
  sourceSha: "abc123",
  artifactIdentity: "sha256:artifact",
};

function evidence(
  overrides: Partial<ReleasePromotionGateEvidence> = {},
): ReleasePromotionGateEvidence {
  return {
    releaseWorkIdentified: true,
    candidate,
    betaEvidenceSufficient: true,
    humanReleaseApproval: {
      exists: true,
      approvedCandidate: candidate,
    },
    repositoryChecksSatisfied: true,
    releaseBlockersResolved: true,
    workingDecisionsResolved: true,
    enforcement: "unavailable",
    ...overrides,
  };
}

describe("evaluateReleasePromotionGate", () => {
  it("can pass without manufacturing merge authority or human approval", () => {
    expect(evaluateReleasePromotionGate(evidence())).toEqual({
      pass: true,
      blockers: [],
      enforcement: "unavailable",
      grantsMergeAuthority: false,
      executesHumanReleaseApproval: false,
    });
  });

  it("requires a candidate-specific Human Release Approval", () => {
    const result = evaluateReleasePromotionGate(
      evidence({
        humanReleaseApproval: {
          exists: true,
          approvedCandidate: {
            ...candidate,
            sourceSha: "different",
          },
        },
      }),
    );

    expect(result.pass).toBe(false);
    expect(result.blockers).toContain("HUMAN_RELEASE_APPROVAL_STALE");
  });

  it("requires beta evidence before promotion", () => {
    const result = evaluateReleasePromotionGate(
      evidence({ betaEvidenceSufficient: false }),
    );

    expect(result.blockers).toContain("BETA_EVIDENCE_INSUFFICIENT");
  });

  it("fails closed when release identity, approval, checks or decisions are missing", () => {
    const result = evaluateReleasePromotionGate(
      evidence({
        releaseWorkIdentified: false,
        candidate: null,
        humanReleaseApproval: { exists: false, approvedCandidate: null },
        repositoryChecksSatisfied: false,
        releaseBlockersResolved: false,
        workingDecisionsResolved: false,
      }),
    );

    expect(result.pass).toBe(false);
    expect(result.blockers).toEqual([
      "RELEASE_WORK_UNAVAILABLE",
      "CANDIDATE_UNAVAILABLE",
      "HUMAN_RELEASE_APPROVAL_MISSING",
      "REPOSITORY_CHECKS_UNSATISFIED",
      "RELEASE_BLOCKER_PRESENT",
      "WORKING_DECISION_UNRESOLVED",
    ]);
  });
});
