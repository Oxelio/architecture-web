import { createHash } from "node:crypto";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import {
  type ControlledWriteScope,
  planControlledWrite,
  type ReservedWriteContext,
} from "../control/controlled-write.js";
import type { AuthoringTerminalOutcome } from "./authoring-journal-state.js";
import type { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";

type Journal = ReturnType<typeof createGitHubWorkReservationJournal>;
type Boundary = Awaited<ReturnType<Journal["readAuthoringBoundary"]>>;

export interface AuthoringOutcomeProof {
  readonly outcome: AuthoringTerminalOutcome;
  readonly proofDigest: string;
}

export interface ResolvedAuthoringOperation {
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  // Canonical authority, complete scope, exact before-state and credential
  // custody are rechecked here. The callback is not supplied by the caller.
  readonly isCurrent: () => Promise<boolean>;
  readonly readAuthority: () => Promise<string | null>;
  // The adapter uses authorize immediately before its single remote handoff.
  // Only positive, operation-specific evidence may return a terminal proof.
  readonly perform: (
    authorize: () => Promise<boolean>,
  ) => Promise<AuthoringOutcomeProof | null>;
}

export interface AuthoringExecutionPorts {
  readonly journal: Pick<
    Journal,
    "readAuthoringBoundary" | "beginAuthoringWrite" | "finishAuthoringWrite"
  >;
  readonly verifyBoundary: () => Promise<boolean>;
  readonly resolve: (
    request: PreparedAuthoringRequest,
    payload: Uint8Array,
    boundary: Boundary,
  ) => Promise<ResolvedAuthoringOperation | null>;
  // Reuse the native controller's cancel/resolve owner. This callback must not
  // perform the requested write. Confirmed merge requires replan, not mutation.
  readonly cancelOrResolve: (boundary: Boundary) => Promise<void>;
  readonly authorizeRecovery: () => Promise<boolean>;
}

async function resolveAtBoundary(
  request: PreparedAuthoringRequest,
  payload: Uint8Array,
  ports: AuthoringExecutionPorts,
) {
  const boundary = await ports.journal.readAuthoringBoundary();
  const operation = await ports.resolve(request, payload, boundary);
  if (!operation) {
    return null;
  }
  const disposition = planControlledWrite({
    enabled: true,
    scope: operation.scope,
    inventoryComplete: operation.inventoryComplete,
    writePending: boundary.projectStatus !== null,
    reserved: operation.reserved,
  });
  return { boundary, operation, disposition };
}

// One ordinary write, one durable admission, at most one handoff. Recovery is
// deliberately a separate read-only entry point below, never a rerun mode.
export async function executeControlledAuthoring(input: {
  readonly enabled?: boolean;
  readonly workflowSha: string;
  readonly maximumHistoryRevisions: number;
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly ports: AuthoringExecutionPorts;
}): Promise<"inactive" | "denied" | "deferred" | "replan" | "settled"> {
  if (input.enabled !== true) {
    return "inactive";
  }
  const { request, payload, ports } = input;
  if (
    createHash("sha256").update(payload).digest("hex") !==
    request.command.payloadDigest
  ) {
    return "denied";
  }
  try {
    if (!(await ports.verifyBoundary())) {
      return "denied";
    }
    let resolved = await resolveAtBoundary(request, payload, ports);
    if (resolved?.disposition === "cancel-or-resolve") {
      await ports.cancelOrResolve(resolved.boundary);
      resolved = await resolveAtBoundary(request, payload, ports);
    }
    if (resolved?.disposition === "recover-merged") {
      return "replan";
    }
    if (!resolved || resolved.disposition !== "admit") {
      return "deferred";
    }
    return await admitAndPerform(input, resolved);
  } catch {
    // A crash/timeout/lost response never grants permission to retry a write.
    return "deferred";
  }
}

async function admitAndPerform(
  input: Parameters<typeof executeControlledAuthoring>[0],
  resolved: NonNullable<Awaited<ReturnType<typeof resolveAtBoundary>>>,
) {
  const { request, ports } = input;
  const { operation, boundary } = resolved;
  const authorize = async () =>
    (await ports.verifyBoundary()) &&
    (await operation.isCurrent()) &&
    (await operation.readAuthority()) === operation.authorityDigest;
  if (!(await authorize())) {
    return "denied" as const;
  }
  const admission = await ports.journal.beginAuthoringWrite({
    enabled: true,
    previous: boundary.position,
    workflowSha: input.workflowSha,
    request,
    scope: operation.scope,
    reserved: operation.reserved,
    inventoryComplete: operation.inventoryComplete,
    authorityDigest: operation.authorityDigest,
    maximumHistoryRevisions: input.maximumHistoryRevisions,
    readAuthority: operation.readAuthority,
  });
  if (admission.status !== "admitted") {
    return "deferred" as const;
  }
  const proof = (await authorize())
    ? await operation.perform(authorize)
    : {
        outcome: "known-unstarted" as const,
        proofDigest: createHash("sha256")
          .update(
            JSON.stringify([
              "authoring-handoff-not-entered",
              request.requestId,
              admission.position,
            ]),
          )
          .digest("hex"),
      };
  if (!proof) {
    return "deferred" as const;
  }
  const outcome = await ports.journal.finishAuthoringWrite({
    enabled: true,
    requestId: request.requestId,
    maximumHistoryRevisions: input.maximumHistoryRevisions,
    authorizeRecovery: async () =>
      (await ports.verifyBoundary()) && (await ports.authorizeRecovery()),
    observeOutcome: async () => proof,
  });
  return outcome === "settled" ? ("settled" as const) : ("deferred" as const);
}

// Reconciliation cannot fetch sealed source again or invoke a mutation. Its
// operation-specific observer must positively account for an earlier handoff.
export async function reconcileControlledAuthoring(input: {
  readonly enabled?: boolean;
  readonly requestId: string;
  readonly maximumHistoryRevisions: number;
  readonly journal: Pick<Journal, "finishAuthoringWrite">;
  readonly verifyBoundary: () => Promise<boolean>;
  readonly authorizeRecovery: () => Promise<boolean>;
  readonly observeOutcome: Parameters<
    Journal["finishAuthoringWrite"]
  >[0]["observeOutcome"];
}) {
  return input.journal.finishAuthoringWrite({
    enabled: input.enabled === true,
    requestId: input.requestId,
    maximumHistoryRevisions: input.maximumHistoryRevisions,
    authorizeRecovery: async () =>
      (await input.verifyBoundary()) && (await input.authorizeRecovery()),
    observeOutcome: input.observeOutcome,
  });
}
