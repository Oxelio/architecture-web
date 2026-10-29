import { describe, expect, it } from "vitest";

import { planReadyQueue, planTaskDispatch } from "./coordinator.js";
import type {
  TaskDispatchCandidate,
  WorkPullCandidate,
} from "./eligibility.js";

function work(
  workNumber: number,
  priority: WorkPullCandidate["priority"],
  overrides: Partial<WorkPullCandidate> = {},
): WorkPullCandidate {
  return {
    workNumber,
    workOpen: true,
    workStateAvailable: true,
    workState: "Ready",
    dependencyState: "resolved",
    wipState: "available",
    route: { mappingActive: true, labels: ["agent:codex"] },
    priorityAvailable: true,
    priority,
    ...overrides,
  };
}

function task(
  overrides: Partial<TaskDispatchCandidate> = {},
): TaskDispatchCandidate {
  return {
    workNumber: 9,
    taskNumber: 42,
    workOpen: true,
    taskOpen: true,
    taskParentState: "verified",
    workStateAvailable: true,
    workState: "Implementing",
    dependencyState: "resolved",
    route: { mappingActive: true, labels: ["agent:codex"] },
    claimState: "idle",
    targetRef: {
      ref: "technical/agent-aware-delivery-activation",
      source: "authorized-work-context",
      authorizedRefs: ["technical/agent-aware-delivery-activation"],
    },
    ...overrides,
  };
}

describe("planReadyQueue", () => {
  it("selects the next eligible Work without requesting dispatch", () => {
    const plan = planReadyQueue({
      executorRoute: "agent:codex",
      candidates: [
        work(20, "P2 — Normal"),
        work(10, "P1 — High"),
        work(5, "P0 — Critical", { dependencyState: "blocked" }),
      ],
    });

    expect(plan.selectedWorkNumber).toBe(10);
    expect(plan.dispatchRequested).toBe(false);
  });

  it("returns no Work when every candidate fails closed", () => {
    const plan = planReadyQueue({
      executorRoute: "agent:codex",
      candidates: [
        work(1, "P0 — Critical", { wipState: "unavailable" }),
        work(2, "P1 — High", {
          route: { mappingActive: false, labels: ["agent:codex"] },
        }),
      ],
    });

    expect(plan.selectedWorkNumber).toBeNull();
  });
});

describe("planTaskDispatch", () => {
  it("requests a claim and dispatch only for an eligible Task", () => {
    const plan = planTaskDispatch({
      executorRoute: "agent:codex",
      candidate: task(),
    });

    expect(plan.dispatchRequested).toBe(true);
    expect(plan.claimRequired).toBe(true);
    expect(plan.targetRef).toBe("technical/agent-aware-delivery-activation");
  });

  it("never requests dispatch when claim state is inconsistent", () => {
    const plan = planTaskDispatch({
      executorRoute: "agent:codex",
      candidate: task({ claimState: "inconsistent" }),
    });

    expect(plan.dispatchRequested).toBe(false);
    expect(plan.claimRequired).toBe(false);
    expect(plan.decision.blockers).toContain("CLAIM_INCONSISTENT");
  });

  it("rejects malformed executor routes before evaluating state", () => {
    expect(() =>
      planReadyQueue({
        executorRoute: "codex",
        candidates: [],
      }),
    ).toThrow("Invalid executor route 'codex'");
  });
});
