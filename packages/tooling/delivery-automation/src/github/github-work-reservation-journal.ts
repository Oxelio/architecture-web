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
import {
  type MergeCandidate,
  observeReservedWorkSquash,
} from "./work-merge-publisher.js";

interface JournalConnection {
  readonly repositoryToken: string;
  readonly fetchImpl?: FetchLike;
}

// The trusted manual check writer runs in the shared protected Actions group.
// Keep that writer out until the native reservation has conclusively ended.
export async function canPublishManualWorkGate(connection: JournalConnection) {
  const entry = await createGitHubWorkReservationJournal(connection).read();
  return !entry || isTerminal(entry.reservation.state);
}

function isTerminal(state: MergeReservationState): boolean {
  return (
    state.phase === "cancelled" ||
    state.phase === "merged" ||
    state.phase === "invalidated"
  );
}

export async function canRecordWorkCompletion(
  connection: JournalConnection,
  workNumber: number,
): Promise<boolean> {
  const entry = await createGitHubWorkReservationJournal(connection).read();
  if (!entry || isTerminal(entry.reservation.state)) {
    return true;
  }
  const { candidate } = entry.reservation;
  if (
    await observeReservedWorkSquash(
      {
        ...connection,
        repository: "Oxelio/architecture-web",
        repositoryId: 1336937640,
      },
      candidate,
    )
  ) {
    return true;
  }
  if (candidate.workNumber === workNumber) {
    return false;
  }

  const repository = "https://api.github.com/repos/Oxelio/architecture-web";
  const response = await (connection.fetchImpl ?? fetch)(
    `${repository}/issues/${candidate.workNumber}/dependencies/blocked_by?per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${connection.repositoryToken}`,
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
    },
  );
  if (response.status !== 200 || response.headers.has("link")) {
    return false;
  }
  const dependencies: unknown = await response.json();
  return (
    Array.isArray(dependencies) &&
    dependencies.length < 100 &&
    dependencies.every((dependency: unknown) => {
      if (!dependency || typeof dependency !== "object") {
        return false;
      }
      const item = dependency as {
        readonly number?: number;
        readonly repository_url?: string;
      };
      return (
        Number.isSafeInteger(item.number) &&
        item.repository_url === repository &&
        item.number !== workNumber
      );
    })
  );
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
          return (
            checkId(state["checkId"]) && state["releaseAdmission"] === undefined
          );
        case "release-check":
          return (
            checkId(state["checkId"]) &&
            (state["releaseAdmission"] === undefined ||
              (typeof state["releaseAdmission"] === "string" &&
                digest.test(state["releaseAdmission"])))
          );
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
