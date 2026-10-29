import { describe, expect, it } from "vitest";

import {
  evaluateWorkMergeGate,
  type WorkMergeGateEvidence,
} from "./work-merge-gate.js";

function evidence(
  overrides: Partial<WorkMergeGateEvidence> = {},
): WorkMergeGateEvidence {
  return {
    workIdentified: true,
    workState: "Validating",
    requiredTasksAcceptable: true,
    dependenciesResolved: true,
    applicableReviewsAccepted: true,
    validationSufficient: true,
    priorAuthorityGatesSatisfied: true,
    workingDecisionsResolved: true,
    repositoryChecksSatisfied: true,
    pullRequestMergeable: true,
    enforcement: "unavailable",
    ...overrides,
  };
}

describe("evaluateWorkMergeGate", () => {
  it("can pass while repository enforcement is explicitly unavailable", () => {
    expect(evaluateWorkMergeGate(evidence())).toEqual({
      pass: true,
      blockers: [],
      enforcement: "unavailable",
      grantsMergeAuthority: false,
      impliesDone: false,
    });
  });

  it("does not manufacture review, validation or authority results", () => {
    const result = evaluateWorkMergeGate(
      evidence({
        applicableReviewsAccepted: false,
        validationSufficient: false,
        priorAuthorityGatesSatisfied: false,
      }),
    );

    expect(result.pass).toBe(false);
    expect(result.blockers).toEqual([
      "REVIEW_NOT_ACCEPTED",
      "VALIDATION_INSUFFICIENT",
      "AUTHORITY_GATE_UNSATISFIED",
    ]);
  });

  it("requires the owning Work to be identifiable and Validating", () => {
    const result = evaluateWorkMergeGate(
      evidence({ workIdentified: false, workState: "Reviewing" }),
    );

    expect(result.blockers).toEqual([
      "WORK_IDENTITY_UNAVAILABLE",
      "WORK_NOT_VALIDATING",
    ]);
  });

  it("blocks incomplete Tasks, dependencies, working decisions and repository mergeability", () => {
    const result = evaluateWorkMergeGate(
      evidence({
        requiredTasksAcceptable: false,
        dependenciesResolved: false,
        workingDecisionsResolved: false,
        repositoryChecksSatisfied: false,
        pullRequestMergeable: false,
      }),
    );

    expect(result.pass).toBe(false);
    expect(result.blockers).toEqual([
      "TASK_DISPOSITION_INCOMPLETE",
      "DEPENDENCY_BLOCKED",
      "WORKING_DECISION_UNRESOLVED",
      "REPOSITORY_CHECKS_UNSATISFIED",
      "PR_NOT_MERGEABLE",
    ]);
  });
});
