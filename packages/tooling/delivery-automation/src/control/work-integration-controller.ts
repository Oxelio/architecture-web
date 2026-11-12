import { isDeepStrictEqual } from "node:util";

import type { MergeCandidate } from "../github/work-merge-publisher.js";
import {
  type MergeReservation,
  type MergeReservationEvent,
  transitionMergeReservation,
} from "./merge-reservation.js";

type Operation = Extract<MergeReservationEvent, { kind: "begin" }>["operation"];
type ResultEvent = Exclude<MergeReservationEvent, { kind: "begin" }>;

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
  readonly authorize: (input: {
    readonly candidate: MergeCandidate;
    readonly operation: Operation;
  }) => Promise<boolean>;
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

export async function executeWorkIntegrationOperation(input: {
  readonly candidate: MergeCandidate;
  readonly operation: Operation;
  readonly standingEnabled?: boolean;
  readonly ports: WorkIntegrationControllerPorts;
}): Promise<WorkIntegrationOperationResult> {
  // Recovery also requires explicit authority, but must remain available if
  // standing operation was revoked after GitHub accepted an earlier request.
  if (input.operation !== "resolve" && input.standingEnabled !== true) {
    return { status: "inactive" };
  }

  const { candidate, operation, ports } = input;
  const request = { candidate, operation };

  try {
    const previous = await ports.readReservation();
    const pending = transitionMergeReservation(
      previous.reservation,
      candidate,
      {
        kind: "begin",
        operation,
      },
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

    const event = await ports.perform(intent);
    const next = event && transitionMergeReservation(pending, candidate, event);
    if (!next) {
      return { status: "deferred" };
    }
    const receipt = await ports.append(intent, next);
    return receipt ? { status: "confirmed", receipt } : { status: "deferred" };
  } catch {
    return { status: "deferred" };
  }
}
