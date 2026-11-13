import { isDeepStrictEqual } from "node:util";

import type { MergeCandidate } from "../github/work-merge-publisher.js";
import {
  type MergeReservation,
  type MergeReservationEvent,
  transitionMergeReservation,
} from "./merge-reservation.js";
import { sameWorkIntegrationCandidate } from "./work-integration-request.js";

type Operation = Extract<MergeReservationEvent, { kind: "begin" }>["operation"];
type ResultEvent = Exclude<
  MergeReservationEvent,
  { kind: "begin" | "begin-invalidation" }
>;
type OperationRequest =
  | { readonly operation: Operation; readonly writeId?: never }
  | { readonly operation: "invalidate"; readonly writeId: string };
type AuthorizationRequest =
  | (OperationRequest & { readonly candidate: MergeCandidate })
  | {
      readonly candidate: MergeCandidate;
      readonly operation: "resolve";
      readonly writeId: string;
    };

export interface WorkIntegrationReservationReceipt {
  readonly revision: number;
  readonly reservation: MergeReservation;
}

interface WorkIntegrationControllerPorts {
  readonly readReservation: () => Promise<WorkIntegrationReservationReceipt>;
  // A non-null receipt requires winning the durable create-only append.
  // Reading a matching revision after a lost response does not prove a win.
  readonly append: (
    previous: WorkIntegrationReservationReceipt,
    reservation: MergeReservation,
  ) => Promise<WorkIntegrationReservationReceipt | null>;
  readonly authorize: (input: AuthorizationRequest) => Promise<boolean>;
  // Use operation-specific, verified GitHub observations as result evidence.
  // An uncertain response or insufficient evidence returns null.
  readonly perform: (
    intent: WorkIntegrationReservationReceipt,
  ) => Promise<ResultEvent | null>;
}

export type WorkIntegrationOperationResult =
  | {
      readonly status: "confirmed";
      readonly receipt: WorkIntegrationReservationReceipt;
    }
  | { readonly status: "inactive" | "denied" | "deferred" };

export async function executeWorkIntegrationOperation(
  input: OperationRequest & {
    readonly candidate: MergeCandidate;
    readonly standingEnabled?: boolean;
    readonly ports: WorkIntegrationControllerPorts;
  },
): Promise<WorkIntegrationOperationResult> {
  // Recovery also requires explicit authority, but must remain available if
  // standing operation was revoked after GitHub accepted an earlier request.
  if (input.operation !== "resolve" && input.standingEnabled !== true) {
    return { status: "inactive" };
  }

  const { candidate, operation, ports } = input;
  const request: AuthorizationRequest =
    operation === "invalidate"
      ? { candidate, operation, writeId: input.writeId }
      : { candidate, operation };
  const event: MergeReservationEvent =
    operation === "invalidate"
      ? { kind: "begin-invalidation", writeId: input.writeId }
      : { kind: "begin", operation };

  try {
    const previous = await ports.readReservation();
    const pending = transitionMergeReservation(
      previous.reservation,
      candidate,
      event,
    );
    if (!pending) {
      return { status: "deferred" };
    }
    if (!(await ports.authorize(request))) {
      return { status: "denied" };
    }

    const intent = await ports.append(previous, pending);
    if (
      !intent ||
      intent.revision !== previous.revision + 1 ||
      !isDeepStrictEqual(intent.reservation, pending)
    ) {
      return { status: "deferred" };
    }
    if (!(await ports.authorize(request))) {
      // Keep the intent. Recovery must reconcile it before another writer can
      // act, even though this invocation has not sent the operation.
      return { status: "denied" };
    }

    const result = await ports.perform(intent);
    const next =
      result && transitionMergeReservation(pending, candidate, result);
    if (!next) {
      return { status: "deferred" };
    }
    return await confirmResult(ports, intent, next);
  } catch {
    return { status: "deferred" };
  }
}

async function confirmResult(
  ports: Pick<WorkIntegrationControllerPorts, "append">,
  intent: WorkIntegrationReservationReceipt,
  next: MergeReservation,
): Promise<WorkIntegrationOperationResult> {
  const receipt = await ports.append(intent, next);
  return receipt &&
    receipt.revision === intent.revision + 1 &&
    isDeepStrictEqual(receipt.reservation, next)
    ? { status: "confirmed", receipt }
    : { status: "deferred" };
}

export async function reconcileWorkIntegrationOperation(input: {
  readonly candidate: MergeCandidate;
  readonly ports: Omit<WorkIntegrationControllerPorts, "perform"> & {
    // Read-only: a positive observation must identify this exact intent.
    readonly observe: (
      intent: WorkIntegrationReservationReceipt,
    ) => Promise<ResultEvent | null>;
  };
}): Promise<WorkIntegrationOperationResult> {
  const { candidate, ports } = input;

  try {
    const intent = await ports.readReservation();
    const { state } = intent.reservation;
    if (
      (state.phase !== "pending" && state.phase !== "invalidating") ||
      !sameWorkIntegrationCandidate(candidate, intent.reservation.candidate)
    ) {
      return { status: "deferred" };
    }
    const recovery: AuthorizationRequest =
      state.phase === "invalidating"
        ? { candidate, operation: "resolve", writeId: state.writeId }
        : { candidate, operation: "resolve" };
    if (!(await ports.authorize(recovery))) {
      return { status: "denied" };
    }

    const event = await ports.observe(intent);
    const next =
      event && transitionMergeReservation(intent.reservation, candidate, event);
    if (!next) {
      return { status: "deferred" };
    }
    if (!(await ports.authorize(recovery))) {
      return { status: "denied" };
    }
    return await confirmResult(ports, intent, next);
  } catch {
    return { status: "deferred" };
  }
}
