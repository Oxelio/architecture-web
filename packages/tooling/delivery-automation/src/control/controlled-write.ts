import type { MergeReservation } from "./merge-reservation.js";

export type ControlledWriteKind =
  | "publish-commit"
  | "edit-pull-request"
  | "edit-work"
  | "edit-task-dependency"
  | "record-evidence"
  | "record-project-field";

export interface ControlledWriteScope {
  readonly repositoryId: number;
  readonly kind: ControlledWriteKind;
  readonly affectedWorks: readonly number[];
  readonly affectedPulls: readonly number[];
  readonly affectedRefs: readonly string[];
}

export interface ReservedWriteContext {
  readonly reservation: MergeReservation;
  // These sets are constructed from canonical owners by trusted intake.
  // They include reverse/shared dependencies, the integration base ref,
  // and every PR using a source ref.
  readonly relevantWorks: readonly number[];
  readonly relevantPulls: readonly number[];
  readonly relevantRefs: readonly string[];
}

export type ControlledWriteDisposition =
  | "inactive"
  | "denied"
  | "defer"
  | "admit"
  | "cancel-or-resolve"
  | "recover-merged";

const kinds: readonly ControlledWriteKind[] = [
  "publish-commit",
  "edit-pull-request",
  "edit-work",
  "edit-task-dependency",
  "record-evidence",
  "record-project-field",
];

function validIds(values: readonly number[]) {
  return (
    values.every((id) => Number.isSafeInteger(id) && id > 0) &&
    new Set(values).size === values.length
  );
}

function validRefs(values: readonly string[]) {
  return (
    new Set(values).size === values.length &&
    values.every((ref) => ref.startsWith("refs/heads/") && ref.length > 11)
  );
}

// This read-only planner grants no authority and creates no reservation.
// Runtime writers still need authenticated commands, complete owner-derived
// scope, exclusive credentials, durable single-use admission and read-back.
export function planControlledWrite(input: {
  readonly enabled?: boolean;
  readonly scope: ControlledWriteScope;
  readonly inventoryComplete: boolean;
  readonly writePending: boolean;
  readonly reserved: ReservedWriteContext | null;
}): ControlledWriteDisposition {
  if (input.enabled !== true) {
    return "inactive";
  }
  const { scope, reserved } = input;
  if (
    scope.repositoryId !== 1336937640 ||
    !kinds.includes(scope.kind) ||
    !validIds(scope.affectedWorks) ||
    scope.affectedWorks.length === 0 ||
    !validIds(scope.affectedPulls) ||
    !validRefs(scope.affectedRefs)
  ) {
    return "denied";
  }
  if (!input.inventoryComplete || input.writePending) {
    return "defer";
  }
  if (!reserved) {
    return "admit";
  }
  if (
    !validIds(reserved.relevantWorks) ||
    !validIds(reserved.relevantPulls) ||
    !reserved.relevantWorks.includes(
      reserved.reservation.candidate.workNumber,
    ) ||
    !reserved.relevantPulls.includes(
      reserved.reservation.candidate.pullNumber,
    ) ||
    reserved.relevantRefs.length === 0 ||
    !validRefs(reserved.relevantRefs)
  ) {
    return "defer";
  }

  const intersects =
    scope.affectedWorks.some((id) => reserved.relevantWorks.includes(id)) ||
    scope.affectedPulls.some((id) => reserved.relevantPulls.includes(id)) ||
    scope.affectedRefs.some((ref) => reserved.relevantRefs.includes(ref));

  // Even an unrelated write needs a durable admission against the same
  // journal revision. This result never implies it may race a reservation.
  if (!intersects) {
    return "admit";
  }
  switch (reserved.reservation.state.phase) {
    case "cancelled":
      return "admit";
    case "merged":
      return "recover-merged";
    case "reserved":
    case "queued":
    case "armed":
    case "released":
      return "cancel-or-resolve";
    default:
      return "defer";
  }
}
