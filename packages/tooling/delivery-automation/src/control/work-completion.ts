import type { WorkState } from "./eligibility.js";

export interface WorkCompletionSnapshot {
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly baseRef: "main";
  readonly mergeSha: string;
  readonly projectItemId: string;
  readonly status: WorkState;
  // A deliberately reopened or otherwise conflicting Issue has disposition other.
  readonly issueDisposition: "open" | "completed" | "other";
  readonly scopeConcluded: boolean;
  readonly reviewsAccepted: boolean;
  readonly validationSufficient: boolean;
  readonly durableOwnersSynchronized: boolean;
  readonly workingDecisionsResolved: boolean;
  readonly postMergeObligationsSatisfied: boolean;
}

export interface WorkCompletionPublisher {
  // The trusted reader resolves a unique Work from a confirmed merge into main
  // and reads the applicable results from their owners.
  readonly read: () => Promise<WorkCompletionSnapshot | null>;
  readonly writeDone: (projectItemId: string) => Promise<void>;
  readonly closeCompleted: (workNumber: number) => Promise<void>;
}

export type WorkCompletionResult =
  | { readonly status: "completed" | "already-completed" }
  | { readonly status: "blocked" | "retry"; readonly reason: string };

function doneEvidence(snapshot: WorkCompletionSnapshot): boolean {
  return (
    snapshot.scopeConcluded === true &&
    snapshot.reviewsAccepted === true &&
    snapshot.validationSufficient === true &&
    snapshot.durableOwnersSynchronized === true &&
    snapshot.workingDecisionsResolved === true &&
    snapshot.postMergeObligationsSatisfied === true
  );
}

function sameWork(
  a: WorkCompletionSnapshot,
  b: WorkCompletionSnapshot,
): boolean {
  return (
    a.workNumber === b.workNumber &&
    a.pullNumber === b.pullNumber &&
    a.baseRef === b.baseRef &&
    a.mergeSha === b.mergeSha &&
    a.projectItemId === b.projectItemId
  );
}

// Invoke in the trusted, per-Work serialized publisher.
export async function publishWorkCompletion(
  publisher: WorkCompletionPublisher,
): Promise<WorkCompletionResult> {
  try {
    const initial = await publisher.read();
    if (
      !initial ||
      initial.baseRef !== "main" ||
      !/^[0-9a-f]{40}$/u.test(initial.mergeSha) ||
      (initial.status !== "Validating" && initial.status !== "Done")
    ) {
      return { status: "blocked", reason: "WORK_NOT_ELIGIBLE" };
    }
    if (!doneEvidence(initial)) {
      return { status: "blocked", reason: "DONE_EVIDENCE_INCOMPLETE" };
    }
    if (initial.status === "Done" && initial.issueDisposition === "completed") {
      return { status: "already-completed" };
    }
    if (initial.issueDisposition !== "open") {
      return { status: "blocked", reason: "ISSUE_DISPOSITION_CONFLICT" };
    }
    if (initial.status === "Validating") {
      await publisher.writeDone(initial.projectItemId);
    }

    const verified = await publisher.read();
    if (
      !verified ||
      !sameWork(initial, verified) ||
      verified.status !== "Done" ||
      !doneEvidence(verified)
    ) {
      return { status: "retry", reason: "DONE_NOT_VERIFIED" };
    }
    if (verified.issueDisposition === "completed") {
      return { status: "completed" };
    }
    if (verified.issueDisposition !== "open") {
      return { status: "blocked", reason: "ISSUE_DISPOSITION_CONFLICT" };
    }
    await publisher.closeCompleted(initial.workNumber);
    const closed = await publisher.read();
    if (
      closed &&
      sameWork(initial, closed) &&
      closed.status === "Done" &&
      closed.issueDisposition === "completed" &&
      doneEvidence(closed)
    ) {
      return { status: "completed" };
    }
    return { status: "retry", reason: "CLOSURE_NOT_VERIFIED" };
  } catch {
    return { status: "retry", reason: "COMPLETION_NOT_CONFIRMED" };
  }
}
