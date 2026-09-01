import { describe, expect, it } from "vitest";

import {
  evaluateTaskClaimAcquisition,
  evaluateTaskDispatch,
  evaluateWorkPull,
  selectNextWork,
  type TaskDispatchCandidate,
  type WorkPullCandidate,
} from "./eligibility.js";

function target(ref = "technical/example"): TaskDispatchCandidate["targetRef"] {
  return {
    ref,
    source: "authorized-work-context",
    authorizedRefs: [ref],
  };
}

function work(overrides: Partial<WorkPullCandidate> = {}): WorkPullCandidate {
  return {
    workNumber: 10,
    workOpen: true,
    workStateAvailable: true,
    workState: "Ready",
    dependencyState: "resolved",
    wipState: "available",
    route: { mappingActive: true, labels: ["agent:codex"] },
    priorityAvailable: true,
    priority: "P2 — Normal",
    ...overrides,
  };
}

function task(
  overrides: Partial<TaskDispatchCandidate> = {},
): TaskDispatchCandidate {
  return {
    workNumber: 10,
    taskNumber: 11,
    workOpen: true,
    taskOpen: true,
    taskParentState: "verified",
    workStateAvailable: true,
    workState: "Implementing",
    dependencyState: "resolved",
    route: { mappingActive: true, labels: ["agent:codex"] },
    claimState: "idle",
    targetRef: target(),
    ...overrides,
  };
}

describe("evaluateWorkPull", () => {
  it("accepts only an eligible open Ready Work routed to the executor", () => {
    expect(evaluateWorkPull(work(), "agent:codex")).toEqual({
      eligible: true,
      blockers: [],
      route: "agent:codex",
      targetRef: null,
    });
  });

  it("does not require a Work Integration PR or target ref to enter the Ready Queue", () => {
    const decision = evaluateWorkPull(work(), "agent:codex");

    expect(decision.eligible).toBe(true);
    expect(decision.targetRef).toBeNull();
    expect(decision.blockers).not.toContain("TARGET_REF_UNAVAILABLE");
  });

  it("blocks a closed Work even when its last Work State remains Ready", () => {
    const decision = evaluateWorkPull(work({ workOpen: false }), "agent:codex");

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("WORK_CLOSED");
  });

  it("fails closed when lifecycle, dependency, WIP, route or priority owners are unavailable", () => {
    const decision = evaluateWorkPull(
      work({
        workStateAvailable: false,
        workState: null,
        dependencyState: "unavailable",
        wipState: "unavailable",
        route: { mappingActive: false, labels: [] },
        priorityAvailable: false,
        priority: null,
      }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toEqual([
      "WORK_STATE_OWNER_UNAVAILABLE",
      "DEPENDENCY_OWNER_UNAVAILABLE",
      "WIP_STATE_UNAVAILABLE",
      "ROUTE_OWNER_UNAVAILABLE",
      "PRIORITY_OWNER_UNAVAILABLE",
    ]);
  });

  it("blocks conflicting agent routes", () => {
    const decision = evaluateWorkPull(
      work({
        route: {
          mappingActive: true,
          labels: ["agent:codex", "agent:human", "char:security"],
        },
      }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_CONFLICT");
  });

  it("never selects a human-only route for automated dispatch", () => {
    const decision = evaluateWorkPull(
      work({ route: { mappingActive: true, labels: ["agent:human"] } }),
      "agent:human",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_HUMAN_ONLY");
  });

  it("keeps a Work routed elsewhere valid but not executable by this executor", () => {
    const decision = evaluateWorkPull(
      work({ route: { mappingActive: true, labels: ["agent:other"] } }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_MISMATCH");
  });
});

describe("selectNextWork", () => {
  it("orders eligible Work by Priority then deterministic Work number", () => {
    const decision = selectNextWork(
      [
        work({ workNumber: 20, priority: "P2 — Normal" }),
        work({ workNumber: 30, priority: "P1 — High" }),
        work({ workNumber: 25, priority: "P1 — High" }),
        work({
          workNumber: 5,
          priority: "P0 — Critical",
          dependencyState: "blocked",
        }),
      ],
      "agent:codex",
    );

    expect(decision.selectedWorkNumber).toBe(25);
    expect(
      decision.candidates.find((candidate) => candidate.workNumber === 5)
        ?.decision.blockers,
    ).toContain("DEPENDENCY_BLOCKED");
  });
});

describe("evaluateTaskClaimAcquisition", () => {
  it("allows an explicit human claim without requiring an automated route", () => {
    expect(
      evaluateTaskClaimAcquisition(
        task({ route: { mappingActive: false, labels: ["agent:human"] } }),
        { kind: "human" },
      ),
    ).toEqual({
      eligible: true,
      blockers: [],
      route: null,
      targetRef: "technical/example",
    });
  });

  it("allows a human claim when the active route explicitly selects human execution", () => {
    expect(
      evaluateTaskClaimAcquisition(
        task({ route: { mappingActive: true, labels: ["agent:human"] } }),
        { kind: "human" },
      ),
    ).toEqual({
      eligible: true,
      blockers: [],
      route: "agent:human",
      targetRef: "technical/example",
    });
  });

  it("blocks a human claim from bypassing an explicitly automated route", () => {
    const decision = evaluateTaskClaimAcquisition(task(), { kind: "human" });

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_MISMATCH");
  });

  it("revalidates the selected route immediately before an automated claim", () => {
    expect(
      evaluateTaskClaimAcquisition(task(), {
        kind: "automated",
        executorRoute: "agent:codex",
      }),
    ).toEqual({
      eligible: true,
      blockers: [],
      route: "agent:codex",
      targetRef: "technical/example",
    });
  });

  it("blocks an automated claim when the route changed after planning", () => {
    const decision = evaluateTaskClaimAcquisition(
      task({ route: { mappingActive: true, labels: ["agent:other"] } }),
      { kind: "automated", executorRoute: "agent:codex" },
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_MISMATCH");
  });

  it("blocks an automated claim when the route becomes human-only", () => {
    const decision = evaluateTaskClaimAcquisition(
      task({ route: { mappingActive: true, labels: ["agent:human"] } }),
      { kind: "automated", executorRoute: "agent:codex" },
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_HUMAN_ONLY");
  });

  it("fails closed when the route owner is unavailable for an automated claim", () => {
    const decision = evaluateTaskClaimAcquisition(
      task({ route: { mappingActive: false, labels: [] } }),
      { kind: "automated", executorRoute: "agent:codex" },
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_OWNER_UNAVAILABLE");
  });

  it("fails closed when Task ownership or target state is unavailable", () => {
    const decision = evaluateTaskClaimAcquisition(
      task({
        taskParentState: "unavailable",
        targetRef: { ref: null, source: null, authorizedRefs: [] },
      }),
      { kind: "human" },
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("TASK_PARENT_OWNER_UNAVAILABLE");
    expect(decision.blockers).toContain("TARGET_REF_UNAVAILABLE");
  });
});

describe("evaluateTaskDispatch", () => {
  it("allows one open Task with its verified parent inside an open Implementing Work", () => {
    expect(evaluateTaskDispatch(task(), "agent:codex")).toEqual({
      eligible: true,
      blockers: [],
      route: "agent:codex",
      targetRef: "technical/example",
    });
  });

  it("blocks closed Work or Task independently from lifecycle state", () => {
    const decision = evaluateTaskDispatch(
      task({ workOpen: false, taskOpen: false }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toEqual(["WORK_CLOSED", "TASK_CLOSED"]);
  });

  it("distinguishes an unreadable Task parent from a wrong parent", () => {
    const unavailable = evaluateTaskDispatch(
      task({ taskParentState: "unavailable" }),
      "agent:codex",
    );
    const mismatch = evaluateTaskDispatch(
      task({ taskParentState: "mismatch" }),
      "agent:codex",
    );

    expect(unavailable.blockers).toContain("TASK_PARENT_OWNER_UNAVAILABLE");
    expect(mismatch.blockers).toContain("TASK_PARENT_MISMATCH");
  });

  it("blocks when the Work is not Implementing or another Task already owns the claim", () => {
    const decision = evaluateTaskDispatch(
      task({ workState: "Ready", claimState: "active" }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toEqual([
      "WORK_NOT_IMPLEMENTING",
      "CLAIM_ACTIVE",
    ]);
  });

  it("fails closed when claim ownership cannot be read or is internally inconsistent", () => {
    const unavailable = evaluateTaskDispatch(
      task({ claimState: "unavailable" }),
      "agent:codex",
    );
    const inconsistent = evaluateTaskDispatch(
      task({ claimState: "inconsistent" }),
      "agent:codex",
    );

    expect(unavailable.blockers).toContain("CLAIM_OWNER_UNAVAILABLE");
    expect(inconsistent.blockers).toContain("CLAIM_INCONSISTENT");
  });

  it("does not inherit a parent route when the executable Task is unassigned", () => {
    const decision = evaluateTaskDispatch(
      task({ route: { mappingActive: true, labels: ["char:security"] } }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_UNASSIGNED");
  });

  it("never dispatches a Task whose selected route is human-only", () => {
    const decision = evaluateTaskDispatch(
      task({ route: { mappingActive: true, labels: ["agent:human"] } }),
      "agent:human",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("ROUTE_HUMAN_ONLY");
  });

  it("rejects a target ref sourced from agent output even if its value is authorized", () => {
    const decision = evaluateTaskDispatch(
      task({
        targetRef: {
          ref: "technical/example",
          source: "agent-output",
          authorizedRefs: ["technical/example"],
        },
      }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("TARGET_REF_FROM_AGENT_OUTPUT");
  });

  it("rejects an explicit ref that is not in the authorized Work context", () => {
    const decision = evaluateTaskDispatch(
      task({
        targetRef: {
          ref: "main",
          source: "authorized-work-context",
          authorizedRefs: ["technical/example"],
        },
      }),
      "agent:codex",
    );

    expect(decision.eligible).toBe(false);
    expect(decision.blockers).toContain("TARGET_REF_NOT_AUTHORIZED");
  });
});
