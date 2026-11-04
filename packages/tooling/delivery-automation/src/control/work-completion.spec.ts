import { describe, expect, it, vi } from "vitest";

import {
  publishWorkCompletion,
  type WorkCompletionSnapshot,
} from "./work-completion.js";

function fixture() {
  let snapshot: WorkCompletionSnapshot = {
    workNumber: 91,
    pullNumber: 92,
    baseRef: "main",
    mergeSha: "a".repeat(40),
    projectItemId: "item",
    status: "Validating",
    issueDisposition: "open",
    scopeConcluded: true,
    reviewsAccepted: true,
    validationSufficient: true,
    durableOwnersSynchronized: true,
    workingDecisionsResolved: true,
    postMergeObligationsSatisfied: true,
  };
  const update = (changes: Partial<WorkCompletionSnapshot>) => {
    snapshot = { ...snapshot, ...changes };
  };
  return {
    update,
    publisher: {
      read: vi.fn(async () => snapshot),
      writeDone: vi.fn(async (_itemId: string) => update({ status: "Done" })),
      closeCompleted: vi.fn(async (_workNumber: number) =>
        update({ issueDisposition: "completed" }),
      ),
    },
  };
}

describe("conditional Work closure", () => {
  it("requires post-merge evidence before changing either owner", async () => {
    const { publisher, update } = fixture();
    update({ postMergeObligationsSatisfied: false });
    await expect(publishWorkCompletion(publisher)).resolves.toMatchObject({
      status: "blocked",
    });
    expect(publisher.writeDone).not.toHaveBeenCalled();
    expect(publisher.closeCompleted).not.toHaveBeenCalled();
  });

  it("reads back Done and retries a partial failure without writing Done twice", async () => {
    const { publisher } = fixture();
    publisher.closeCompleted.mockRejectedValueOnce(
      new Error("GitHub unavailable"),
    );
    await expect(publishWorkCompletion(publisher)).resolves.toMatchObject({
      status: "retry",
    });
    await expect(publishWorkCompletion(publisher)).resolves.toEqual({
      status: "completed",
    });
    await expect(publishWorkCompletion(publisher)).resolves.toEqual({
      status: "already-completed",
    });
    expect(publisher.writeDone).toHaveBeenCalledExactlyOnceWith("item");
    expect(publisher.closeCompleted).toHaveBeenCalledTimes(2);
    expect(publisher.closeCompleted).toHaveBeenLastCalledWith(91);
  });

  it("leaves the Issue open if the readback does not confirm Done", async () => {
    const { publisher } = fixture();
    publisher.writeDone.mockResolvedValueOnce(undefined);
    await expect(publishWorkCompletion(publisher)).resolves.toEqual({
      status: "retry",
      reason: "DONE_NOT_VERIFIED",
    });
    expect(publisher.closeCompleted).not.toHaveBeenCalled();
  });

  it("leaves a deliberately reopened Issue for the coordinator", async () => {
    const { publisher, update } = fixture();
    update({ status: "Done", issueDisposition: "other" });
    await expect(publishWorkCompletion(publisher)).resolves.toEqual({
      status: "blocked",
      reason: "ISSUE_DISPOSITION_CONFLICT",
    });
    expect(publisher.closeCompleted).not.toHaveBeenCalled();
  });
});
