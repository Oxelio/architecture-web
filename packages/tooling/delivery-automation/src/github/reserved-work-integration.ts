import type { MergeReservation } from "../control/merge-reservation.js";
import { workMergeRequiredCheckName } from "../control/work-merge-gate.js";
import { queueReservedGateCheck } from "./gate-check-publisher.js";
import {
  armReservedWorkSquash,
  observeReservedWorkSquash,
  releaseReservedWorkMergeGate,
  type WorkMergePublisher,
} from "./work-merge-publisher.js";

export async function performReservedGitHubIntegration(
  reservation: MergeReservation,
  scope: {
    readonly publisher: WorkMergePublisher;
    readonly reservationId: string;
    readonly checksToken: string;
    readonly checksAppId: number;
    readonly controllerBotId: number;
  },
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
