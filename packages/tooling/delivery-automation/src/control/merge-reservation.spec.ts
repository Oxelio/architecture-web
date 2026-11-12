import { describe, expect, it } from "vitest";

import {
  invalidatingWriteDisposition,
  type MergeReservation,
  type MergeReservationEvent,
  transitionMergeReservation,
} from "./merge-reservation.js";

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const initial: MergeReservation = { candidate, state: { phase: "reserved" } };

function move(
  state: MergeReservation,
  event: MergeReservationEvent,
): MergeReservation {
  const result = transitionMergeReservation(state, candidate, event);
  if (!result) {
    throw new Error("fixture transition refused");
  }
  return result;
}

const check = move(initial, { kind: "begin", operation: "queue-check" });
const queued = move(check, { kind: "check-queued", checkId: 17 });
const arm = move(queued, { kind: "begin", operation: "arm-squash" });
const armed = move(arm, { kind: "squash-armed", checkId: 17 });
const release = move(armed, { kind: "begin", operation: "release-check" });
const released = move(release, { kind: "check-released", checkId: 17 });

describe("merge reservation", () => {
  it("requires a pending intent and verifies the same check at each step", () => {
    expect(
      transitionMergeReservation(initial, candidate, {
        kind: "check-queued",
        checkId: 17,
      }),
    ).toBeNull();
    expect(
      transitionMergeReservation(release, candidate, {
        kind: "check-released",
        checkId: 18,
      }),
    ).toBeNull();
    expect(released.state).toEqual({ phase: "released", checkId: 17 });
  });

  it("does not let an unresolved arm or release be retried or displaced", () => {
    for (const pending of [check, arm, release]) {
      expect(invalidatingWriteDisposition(pending)).toBe("defer");
      expect(
        transitionMergeReservation(pending, candidate, {
          kind: "begin",
          operation: "resolve",
        }),
      ).toBeNull();
    }
  });

  it("requires terminal proof before and after the check release", () => {
    for (const current of [armed, released]) {
      const resolving = move(current, { kind: "begin", operation: "resolve" });
      expect(invalidatingWriteDisposition(resolving)).toBe("defer");
      expect(
        invalidatingWriteDisposition(
          move(resolving, { kind: "squash-cancelled" }),
        ),
      ).toBe("apply");
      expect(
        invalidatingWriteDisposition(
          move(resolving, { kind: "squash-merged", sha: "c".repeat(40) }),
        ),
      ).toBe("recover");
    }
  });

  it("rejects a changed candidate and prevents reuse after cancellation", () => {
    const resolving = move(released, { kind: "begin", operation: "resolve" });
    const cancelled = move(resolving, { kind: "squash-cancelled" });
    expect(
      transitionMergeReservation(
        resolving,
        { ...candidate, baseSha: "c".repeat(40) },
        { kind: "squash-cancelled" },
      ),
    ).toBeNull();
    expect(
      transitionMergeReservation(cancelled, candidate, {
        kind: "begin",
        operation: "arm-squash",
      }),
    ).toBeNull();
  });
});
