import { isDeepStrictEqual } from "node:util";

import type {
  MergeReservation,
  MergeReservationState,
} from "../control/merge-reservation.js";
import type { WorkIntegrationReservationReceipt } from "../control/work-integration-controller.js";
import {
  isWorkIntegrationCandidate,
  sameWorkIntegrationCandidate,
} from "../control/work-integration-request.js";
import type { FetchLike } from "./github-project-inventory.js";
import {
  appendMergeJournalRevision,
  type MergeJournalPosition,
  readMergeJournalTail,
} from "./merge-reservation-journal.js";
import type { MergeCandidate } from "./work-merge-publisher.js";

interface JournalConnection {
  readonly repositoryToken: string;
  readonly fetchImpl?: FetchLike;
}

interface PersistedReservation
  extends WorkIntegrationReservationReceipt, MergeJournalPosition {
  readonly reservationId: string;
}

const sha = /^[0-9a-f]{40}$/u;
const digest = /^[0-9a-f]{64}$/u;

function checkId(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isReservationState(value: unknown): value is MergeReservationState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as Record<string, unknown>;
  switch (state["phase"]) {
    case "reserved":
    case "cancelled":
      return true;
    case "queued":
    case "armed":
    case "released":
      return checkId(state["checkId"]);
    case "pending":
      switch (state["operation"]) {
        case "queue-check":
          return state["checkId"] === undefined;
        case "arm-squash":
        case "release-check":
          return checkId(state["checkId"]);
        case "resolve":
          return state["previousPhase"] === "reserved"
            ? state["checkId"] === undefined
            : (state["previousPhase"] === "queued" ||
                state["previousPhase"] === "armed" ||
                state["previousPhase"] === "released") &&
                checkId(state["checkId"]);
        default:
          return false;
      }
    case "invalidating":
    case "invalidated":
      return (
        typeof state["writeId"] === "string" && digest.test(state["writeId"])
      );
    case "merged":
      return typeof state["sha"] === "string" && sha.test(state["sha"]);
    default:
      return false;
  }
}

function reservationRevision(id: unknown): number {
  return typeof id === "string"
    ? Number(id.match(/^delivery-control\/r([1-9]\d*)$/u)?.[1])
    : Number.NaN;
}

export function createGitHubWorkReservationJournal(
  connection: JournalConnection,
) {
  async function read(): Promise<PersistedReservation | null> {
    const tail = await readMergeJournalTail(connection);
    if (!tail) {
      return null;
    }
    const body = JSON.parse(tail.body) as {
      readonly reservationId?: unknown;
      readonly candidate?: unknown;
      readonly state?: unknown;
    } | null;
    const id = body?.reservationId;
    const origin = reservationRevision(id);
    if (
      typeof id !== "string" ||
      !Number.isSafeInteger(origin) ||
      origin > tail.revision ||
      !isWorkIntegrationCandidate(body?.candidate) ||
      body.candidate.headSha !== tail.candidateHeadSha ||
      !isReservationState(body.state) ||
      (body.state.phase === "reserved") !== (origin === tail.revision)
    ) {
      throw new Error("MERGE_JOURNAL_RESERVATION_UNVERIFIED");
    }

    return {
      revision: tail.revision,
      tagSha: tail.tagSha,
      reservationId: id,
      reservation: { candidate: body.candidate, state: body.state },
    };
  }

  async function appendEntry(
    previous: PersistedReservation | null,
    reservation: MergeReservation,
    reservationId: string,
  ): Promise<PersistedReservation | null> {
    const { candidate, state } = reservation;
    const result = await appendMergeJournalRevision({
      ...connection,
      previous,
      candidateHeadSha: candidate.headSha,
      body: JSON.stringify({ reservationId, candidate, state }),
    });
    if (result.status !== "committed") {
      return null;
    }
    return { ...result.position, reservationId, reservation };
  }

  return {
    read,
    async reserve(
      candidate: MergeCandidate,
    ): Promise<PersistedReservation | null> {
      if (!isWorkIntegrationCandidate(candidate)) {
        return null;
      }
      const previous = await read();
      if (previous) {
        const phase = previous.reservation.state.phase;
        if (
          phase !== "cancelled" &&
          phase !== "merged" &&
          phase !== "invalidated"
        ) {
          return sameWorkIntegrationCandidate(
            candidate,
            previous.reservation.candidate,
          )
            ? previous
            : null;
        }
        if (
          sameWorkIntegrationCandidate(
            candidate,
            previous.reservation.candidate,
          )
        ) {
          return null;
        }
      }
      return appendEntry(
        previous,
        { candidate, state: { phase: "reserved" } },
        `delivery-control/r${(previous?.revision ?? 0) + 1}`,
      );
    },
    async append(
      previous: WorkIntegrationReservationReceipt,
      reservation: MergeReservation,
    ): Promise<PersistedReservation | null> {
      const tail = await read();
      if (
        !tail ||
        tail.revision !== previous.revision ||
        !isDeepStrictEqual(tail.reservation, previous.reservation) ||
        !sameWorkIntegrationCandidate(
          reservation.candidate,
          tail.reservation.candidate,
        ) ||
        reservation.state.phase === "reserved"
      ) {
        return null;
      }
      return appendEntry(tail, reservation, tail.reservationId);
    },
  };
}
