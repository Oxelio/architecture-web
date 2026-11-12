import type { MergeCandidate } from "../github/work-merge-publisher.js";
import { sameWorkIntegrationCandidate } from "./work-integration-request.js";

type Operation = "queue-check" | "arm-squash" | "release-check" | "resolve";

export type MergeReservationState =
  | { readonly phase: "reserved" }
  | { readonly phase: "queued"; readonly checkId: number }
  | { readonly phase: "armed"; readonly checkId: number }
  | { readonly phase: "released"; readonly checkId: number }
  | {
      readonly phase: "pending";
      readonly operation: Operation;
      readonly checkId?: number;
    }
  | { readonly phase: "cancelled" }
  | { readonly phase: "merged"; readonly sha: string };

export interface MergeReservation {
  readonly candidate: MergeCandidate;
  readonly state: MergeReservationState;
}

export type MergeReservationEvent =
  | { readonly kind: "begin"; readonly operation: Operation }
  | { readonly kind: "check-queued"; readonly checkId: number }
  | { readonly kind: "squash-armed"; readonly checkId: number }
  | { readonly kind: "check-released"; readonly checkId: number }
  | { readonly kind: "squash-cancelled" }
  | { readonly kind: "squash-merged"; readonly sha: string };

const oid = /^[0-9a-f]{40}$/u;

function begin(
  state: MergeReservationState,
  operation: Operation,
): MergeReservationState | null {
  if (
    state.phase === "reserved" &&
    (operation === "queue-check" || operation === "resolve")
  ) {
    return { phase: "pending", operation };
  }
  if (
    (state.phase === "queued" && operation === "arm-squash") ||
    (state.phase === "armed" && operation === "release-check")
  ) {
    return { phase: "pending", operation, checkId: state.checkId };
  }
  if (
    operation === "resolve" &&
    (state.phase === "queued" ||
      state.phase === "armed" ||
      state.phase === "released")
  ) {
    return { phase: "pending", operation, checkId: state.checkId };
  }
  return null;
}

// Callers must compare and append the pending intent durably before making
// the corresponding remote mutation. A pending intent permits reconciliation
// only. A provider timeout must not cause the caller to issue it again.
export function transitionMergeReservation(
  reservation: MergeReservation,
  candidate: MergeCandidate,
  event: MergeReservationEvent,
): MergeReservation | null {
  if (!sameWorkIntegrationCandidate(candidate, reservation.candidate)) {
    return null;
  }
  const { state } = reservation;
  if (event.kind === "begin") {
    const pending = begin(state, event.operation);
    return pending ? { candidate, state: pending } : null;
  }
  if (state.phase !== "pending") {
    return null;
  }

  switch (event.kind) {
    case "check-queued":
      return state.operation === "queue-check" &&
        Number.isSafeInteger(event.checkId) &&
        event.checkId > 0
        ? { candidate, state: { phase: "queued", checkId: event.checkId } }
        : null;
    case "squash-armed":
      return state.operation === "arm-squash" && state.checkId === event.checkId
        ? { candidate, state: { phase: "armed", checkId: event.checkId } }
        : null;
    case "check-released":
      return state.operation === "release-check" &&
        state.checkId === event.checkId
        ? { candidate, state: { phase: "released", checkId: event.checkId } }
        : null;
    case "squash-cancelled":
      // This event is an authoritative terminal proof, not an HTTP ACK or
      // a transient absence of autoMergeRequest.
      return state.operation === "resolve"
        ? { candidate, state: { phase: "cancelled" } }
        : null;
    case "squash-merged":
      return (state.operation === "release-check" ||
        state.operation === "resolve") &&
        oid.test(event.sha)
        ? { candidate, state: { phase: "merged", sha: event.sha } }
        : null;
  }
}

export function invalidatingWriteDisposition(
  reservation: MergeReservation,
): "apply" | "defer" | "recover" {
  switch (reservation.state.phase) {
    case "cancelled":
      return "apply";
    case "merged":
      return "recover";
    default:
      return "defer";
  }
}
