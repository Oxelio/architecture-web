import { describe, expect, it } from "vitest";

import {
  mayReconcileAutomatedClaim,
  parseTaskClaim,
  sameTaskClaim,
  taskClaimFields,
  type TaskClaimRecord,
} from "./task-claim.js";

const automatedClaim: TaskClaimRecord = {
  taskNumber: 42,
  claimant: "agent:codex",
  generation: "generation-1",
  runId: "123456",
  acquiredAt: "2026-08-29T16:00:00Z",
};

describe("parseTaskClaim", () => {
  it("recognizes a completely empty claim as idle", () => {
    expect(parseTaskClaim({})).toEqual({ state: "idle" });
  });

  it("round-trips a complete automated claim", () => {
    const parsed = parseTaskClaim(taskClaimFields(automatedClaim));

    expect(parsed).toEqual({ state: "active", record: automatedClaim });
    if (parsed.state === "active") {
      expect(sameTaskClaim(parsed.record, automatedClaim)).toBe(true);
    }
  });

  it("accepts a human claim only without a workflow run", () => {
    const record: TaskClaimRecord = {
      taskNumber: 7,
      claimant: "Oxelio",
      generation: "generation-human",
      runId: null,
      acquiredAt: "2026-08-29T16:00:00Z",
    };

    expect(parseTaskClaim(taskClaimFields(record))).toEqual({
      state: "active",
      record,
    });
  });

  it("fails closed on a partial write", () => {
    expect(
      parseTaskClaim({
        "Execution Claimant": "agent:codex",
        "Execution Claim Generation": "generation-1",
      }),
    ).toEqual({
      state: "inconsistent",
      presentFields: ["Execution Claim Generation", "Execution Claimant"],
    });
  });

  it("fails closed when an automated claim has no workflow run", () => {
    expect(
      parseTaskClaim({
        "Active Task": "42",
        "Execution Claimant": "agent:codex",
        "Execution Claim Generation": "generation-1",
        "Execution Claim Acquired At": "2026-08-29T16:00:00Z",
      }),
    ).toMatchObject({ state: "inconsistent" });
  });

  it("fails closed when a human claim unexpectedly carries an automated run id", () => {
    expect(
      parseTaskClaim({
        "Active Task": "42",
        "Execution Claimant": "Oxelio",
        "Execution Claim Generation": "generation-1",
        "Execution Claim Run": "123",
        "Execution Claim Acquired At": "2026-08-29T16:00:00Z",
      }),
    ).toMatchObject({ state: "inconsistent" });
  });
});

describe("mayReconcileAutomatedClaim", () => {
  it("permits automatic recovery only for a complete automated claim with a completed run", () => {
    const claim = parseTaskClaim(taskClaimFields(automatedClaim));

    expect(mayReconcileAutomatedClaim(claim, { status: "completed" })).toBe(
      true,
    );
    expect(mayReconcileAutomatedClaim(claim, { status: "active" })).toBe(false);
    expect(mayReconcileAutomatedClaim(claim, { status: "unavailable" })).toBe(
      false,
    );
  });

  it("never auto-recovers human claims", () => {
    const human = parseTaskClaim(
      taskClaimFields({
        taskNumber: 7,
        claimant: "Oxelio",
        generation: "generation-human",
        runId: null,
        acquiredAt: "2026-08-29T16:00:00Z",
      }),
    );

    expect(mayReconcileAutomatedClaim(human, { status: "completed" })).toBe(
      false,
    );
  });
});
