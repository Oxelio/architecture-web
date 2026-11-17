import { describe, expect, it } from "vitest";

import {
  type ControlledWriteScope,
  planControlledWrite,
  type ReservedWriteContext,
} from "./controlled-write.js";
import type { MergeReservationState } from "./merge-reservation.js";

const scope: ControlledWriteScope = {
  repositoryId: 1336937640,
  kind: "publish-commit",
  affectedWorks: [120],
  affectedPulls: [125],
  affectedRefs: ["refs/heads/codex/work-120"],
};
const reserved: ReservedWriteContext = {
  reservation: {
    candidate: {
      workNumber: 120,
      pullNumber: 125,
      headSha: "a".repeat(40),
      baseSha: "b".repeat(40),
    },
    state: { phase: "armed", checkId: 17 },
  },
  relevantWorks: [120, 140],
  relevantPulls: [125, 146],
  relevantRefs: ["refs/heads/main", "refs/heads/codex/work-120"],
};
const input = {
  enabled: true,
  scope,
  inventoryComplete: true,
  writePending: false,
  reserved,
};

describe("controlled authoring write planning", () => {
  it("is inactive by default", () => {
    expect(planControlledWrite({ ...input, enabled: false })).toBe("inactive");
    const { enabled: _enabled, ...inactive } = input;
    expect(planControlledWrite(inactive)).toBe("inactive");
  });

  it.each([
    { repositoryId: 1 },
    { kind: "raw-http" as ControlledWriteScope["kind"] },
    { affectedWorks: [] },
    { affectedWorks: [120, 120] },
    { affectedPulls: [0] },
    { affectedRefs: ["refs/tags/v1"] },
    { affectedRefs: ["refs/heads/"] },
    { affectedRefs: ["refs/heads/a", "refs/heads/a"] },
  ])("denies an invalid or out-of-repository request", (change) => {
    expect(
      planControlledWrite({ ...input, scope: { ...scope, ...change } }),
    ).toBe("denied");
  });

  it("defers incomplete inventories and unfinished writes", () => {
    expect(planControlledWrite({ ...input, inventoryComplete: false })).toBe(
      "defer",
    );
    expect(planControlledWrite({ ...input, writePending: true })).toBe("defer");
  });

  it.each<MergeReservationState>([
    { phase: "reserved" },
    { phase: "queued", checkId: 17 },
    { phase: "armed", checkId: 17 },
    { phase: "released", checkId: 17 },
  ])("requires cancellation or conclusive resolution in $phase", (state) => {
    expect(
      planControlledWrite({
        ...input,
        reserved: {
          ...reserved,
          reservation: { ...reserved.reservation, state },
        },
      }),
    ).toBe("cancel-or-resolve");
  });

  it.each<MergeReservationState>([
    { phase: "pending", operation: "arm-squash", checkId: 17 },
    {
      phase: "pending",
      operation: "release-check",
      checkId: 17,
      releaseAdmission: "d".repeat(64),
    },
    {
      phase: "pending",
      operation: "resolve",
      checkId: 17,
      previousPhase: "released",
    },
    { phase: "invalidating", writeId: "d".repeat(64) },
    { phase: "invalidated", writeId: "d".repeat(64) },
  ])("defers unresolved or consumed admission in $phase", (state) => {
    expect(
      planControlledWrite({
        ...input,
        reserved: {
          ...reserved,
          reservation: { ...reserved.reservation, state },
        },
      }),
    ).toBe("defer");
  });

  it("admits only after a confirmed cancellation and routes actual squash to recovery", () => {
    expect(
      planControlledWrite({
        ...input,
        reserved: {
          ...reserved,
          reservation: {
            ...reserved.reservation,
            state: { phase: "cancelled" },
          },
        },
      }),
    ).toBe("admit");
    expect(
      planControlledWrite({
        ...input,
        reserved: {
          ...reserved,
          reservation: {
            ...reserved.reservation,
            state: { phase: "merged", sha: "c".repeat(40) },
          },
        },
      }),
    ).toBe("recover-merged");
  });

  it.each([
    { affectedWorks: [140], affectedPulls: [], affectedRefs: [] },
    { affectedWorks: [91], affectedPulls: [146], affectedRefs: [] },
    {
      affectedWorks: [91],
      affectedPulls: [],
      affectedRefs: ["refs/heads/codex/work-120"],
    },
  ])("includes shared dependency, related PR and ref effects", (change) => {
    expect(
      planControlledWrite({ ...input, scope: { ...scope, ...change } }),
    ).toBe("cancel-or-resolve");
  });

  it("treats an integration base update as invalidating even for a different Work", () => {
    expect(
      planControlledWrite({
        ...input,
        scope: {
          ...scope,
          affectedWorks: [91],
          affectedPulls: [],
          affectedRefs: ["refs/heads/main"],
        },
      }),
    ).toBe("cancel-or-resolve");
  });

  it("keeps a proven unrelated operation eligible for its own durable admission", () => {
    const unrelated = {
      ...scope,
      affectedWorks: [91],
      affectedPulls: [103],
      affectedRefs: ["refs/heads/codex/work-91"],
    };
    expect(planControlledWrite({ ...input, scope: unrelated })).toBe("admit");
    expect(planControlledWrite({ ...input, reserved: null })).toBe("admit");
  });

  it.each([
    { relevantWorks: [] },
    { relevantWorks: [120, 120] },
    { relevantPulls: [146] },
    { relevantRefs: [] },
    { relevantRefs: ["refs/tags/outside"] },
  ])("defers a reserved snapshot missing its canonical scope", (change) => {
    expect(
      planControlledWrite({ ...input, reserved: { ...reserved, ...change } }),
    ).toBe("defer");
  });
});
