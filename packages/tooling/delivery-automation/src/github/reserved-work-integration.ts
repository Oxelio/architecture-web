import { isDeepStrictEqual } from "node:util";

import type { MergeReservation } from "../control/merge-reservation.js";
import {
  executeWorkIntegrationOperation,
  reconcileWorkIntegrationOperation,
  type WorkIntegrationOperationResult,
} from "../control/work-integration-controller.js";
import { workMergeRequiredCheckName } from "../control/work-merge-gate.js";
import {
  observeReservedGateCheck,
  queueReservedGateCheck,
} from "./gate-check-publisher.js";
import { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";
import {
  armReservedWorkSquash,
  observeReservedNativeArm,
  observeReservedWorkSquash,
  releaseReservedWorkMergeGate,
  type WorkMergePublisher,
} from "./work-merge-publisher.js";

interface ReservedGitHubScope {
  readonly publisher: WorkMergePublisher;
  readonly reservationId: string;
  readonly checksToken: string;
  readonly checksAppId: number;
  readonly controllerBotId: number;
}

export async function performReservedGitHubIntegration(
  reservation: MergeReservation,
  scope: ReservedGitHubScope,
) {
  const { candidate, state } = reservation;
  const { publisher, reservationId, checksToken } = scope;
  if (state.phase !== "pending") {
    return null;
  }

  switch (state.operation) {
    case "queue-check": {
      if (
        !checksToken.trim() ||
        [
          publisher.repositoryToken,
          publisher.projectsToken,
          publisher.mergeToken,
        ].includes(checksToken)
      ) {
        return null;
      }
      const check = await queueReservedGateCheck({
        repository: publisher.repository,
        checksToken,
        name: workMergeRequiredCheckName,
        headSha: candidate.headSha,
        reservationId,
        expectedAppId: scope.checksAppId,
        ...(publisher.fetchImpl ? { fetchImpl: publisher.fetchImpl } : {}),
      });
      return check
        ? ({ kind: "check-queued", checkId: check.id } as const)
        : null;
    }
    case "arm-squash": {
      const result = await armReservedWorkSquash(
        publisher,
        reservation,
        reservationId,
      );
      return result.status === "auto-merge-requested" &&
        state.checkId !== undefined
        ? ({ kind: "squash-armed", checkId: state.checkId } as const)
        : null;
    }
    case "release-check": {
      const result = await releaseReservedWorkMergeGate(
        publisher,
        reservation,
        reservationId,
        checksToken,
        scope.controllerBotId,
      );
      if (result.status === "gate-released") {
        return { kind: "check-released", checkId: result.checkId } as const;
      }
      return result.status === "merged" || result.status === "already-merged"
        ? ({ kind: "squash-merged", sha: result.sha } as const)
        : null;
    }
    case "resolve":
      // Absence of a native request is inconclusive. Only a verified squash
      // currently supplies positive terminal evidence through this adapter.
      return observeReservedWorkSquash(publisher, candidate);
  }
}

type ControllerInput = Parameters<typeof executeWorkIntegrationOperation>[0];

export async function executeReservedGitHubWorkIntegration(input: {
  readonly candidate: ControllerInput["candidate"];
  readonly operation: "queue-check" | "arm-squash" | "release-check";
  readonly standingEnabled?: boolean;
  readonly authorize: ControllerInput["ports"]["authorize"];
  readonly scope: Omit<
    Parameters<typeof performReservedGitHubIntegration>[1],
    "reservationId"
  >;
}): Promise<WorkIntegrationOperationResult> {
  if (input.standingEnabled !== true) {
    return { status: "inactive" };
  }
  const { candidate, operation, authorize, scope } = input;
  const journal = journalForScope(scope);
  if (!journal) {
    return { status: "denied" };
  }

  try {
    if (operation === "queue-check") {
      if (!(await authorize({ candidate, operation }))) {
        return { status: "denied" };
      }
      if (!(await journal.reserve(candidate))) {
        return { status: "deferred" };
      }
    }

    return await executeWorkIntegrationOperation({
      candidate,
      operation,
      standingEnabled: true,
      ports: {
        authorize,
        append: journal.append,
        readReservation: async () => {
          const current = await journal.read();
          if (!current) {
            throw new Error("MERGE_JOURNAL_RESERVATION_MISSING");
          }
          return current;
        },
        perform: async (intent) => {
          const current = await journal.read();
          if (
            !current ||
            current.revision !== intent.revision ||
            !isDeepStrictEqual(current.reservation, intent.reservation) ||
            !(await authorize({ candidate, operation }))
          ) {
            return null;
          }
          return performReservedGitHubIntegration(current.reservation, {
            ...scope,
            reservationId: current.reservationId,
          });
        },
      },
    });
  } catch {
    return { status: "deferred" };
  }
}

function journalForScope(scope: Omit<ReservedGitHubScope, "reservationId">) {
  const { publisher, checksToken } = scope;
  if (
    publisher.repository.toLowerCase() !== "oxelio/architecture-web" ||
    publisher.repositoryId !== 1336937640 ||
    !publisher.mergeToken.trim() ||
    !checksToken.trim() ||
    [publisher.repositoryToken, publisher.projectsToken, checksToken].includes(
      publisher.mergeToken,
    ) ||
    [publisher.repositoryToken, publisher.projectsToken].includes(
      checksToken,
    ) ||
    !Number.isSafeInteger(scope.checksAppId) ||
    scope.checksAppId <= 0 ||
    !Number.isSafeInteger(scope.controllerBotId) ||
    scope.controllerBotId <= 0
  ) {
    return null;
  }

  return createGitHubWorkReservationJournal({
    repositoryToken: publisher.mergeToken,
    ...(publisher.fetchImpl ? { fetchImpl: publisher.fetchImpl } : {}),
  });
}

async function observeReservedGitHubIntegration(
  reservation: MergeReservation,
  scope: ReservedGitHubScope,
) {
  const { candidate, state } = reservation;
  if (state.phase !== "pending") {
    return null;
  }
  const { publisher, reservationId, checksToken } = scope;
  const checkScope = {
    repository: publisher.repository,
    checksToken,
    name: workMergeRequiredCheckName,
    headSha: candidate.headSha,
    reservationId,
    expectedAppId: scope.checksAppId,
    ...(publisher.fetchImpl ? { fetchImpl: publisher.fetchImpl } : {}),
  };

  switch (state.operation) {
    case "queue-check": {
      const check = await observeReservedGateCheck(checkScope, {
        state: "queued",
      });
      return check
        ? ({ kind: "check-queued", checkId: check.id } as const)
        : null;
    }
    case "arm-squash":
      if (state.checkId === undefined) {
        return null;
      }
      return (await observeReservedGateCheck(checkScope, {
        state: "queued",
        checkId: state.checkId,
      })) &&
        (await observeReservedNativeArm(
          publisher,
          candidate,
          scope.controllerBotId,
        ))
        ? ({ kind: "squash-armed", checkId: state.checkId } as const)
        : null;
    case "release-check": {
      const merged = await observeReservedWorkSquash(publisher, candidate);
      if (merged || state.checkId === undefined) {
        return merged;
      }
      const check = await observeReservedGateCheck(checkScope, {
        state: "completed",
        checkId: state.checkId,
      });
      return check
        ? ({ kind: "check-released", checkId: check.id } as const)
        : null;
    }
    case "resolve":
      return observeReservedWorkSquash(publisher, candidate);
  }
}

export async function reconcileReservedGitHubWorkIntegration(input: {
  readonly candidate: ControllerInput["candidate"];
  readonly authorize: ControllerInput["ports"]["authorize"];
  readonly scope: Omit<ReservedGitHubScope, "reservationId">;
}): Promise<WorkIntegrationOperationResult> {
  const journal = journalForScope(input.scope);
  if (!journal) {
    return { status: "denied" };
  }

  return reconcileWorkIntegrationOperation({
    candidate: input.candidate,
    ports: {
      authorize: input.authorize,
      append: journal.append,
      readReservation: async () => {
        const current = await journal.read();
        if (!current) {
          throw new Error("MERGE_JOURNAL_RESERVATION_MISSING");
        }
        return current;
      },
      observe: async (intent) => {
        const current = await journal.read();
        if (
          !current ||
          current.revision !== intent.revision ||
          !isDeepStrictEqual(current.reservation, intent.reservation)
        ) {
          return null;
        }
        return observeReservedGitHubIntegration(current.reservation, {
          ...input.scope,
          reservationId: current.reservationId,
        });
      },
    },
  });
}
