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
  const { pending, reservation: entry } =
    await createGitHubWorkReservationJournal(
      connection,
    ).readProjectStatusBoundary();
  if (pending) {
    return false;
  }
  return !entry || (await reservationHasSettled(connection, entry.reservation));
}

async function reservationHasSettled(
  connection: JournalConnection,
  reservation: MergeReservation,
): Promise<boolean> {
  const { phase } = reservation.state;
  return (
    phase === "cancelled" ||
    phase === "merged" ||
    phase === "invalidated" ||
    (await observeReservedWorkSquash(
      {
        ...connection,
        repository: "Oxelio/architecture-web",
        repositoryId: 1336937640,
      },
      reservation.candidate,
    )) !== null
  );
}

export async function canRecordWorkCompletion(
  connection: JournalConnection,
  workNumber: number,
): Promise<boolean> {
  const { pending, reservation: entry } =
    await createGitHubWorkReservationJournal(
      connection,
    ).readProjectStatusBoundary();
  if (pending) {
    return false;
  }
  if (!entry || (await reservationHasSettled(connection, entry.reservation))) {
    return true;
  }
  const { candidate } = entry.reservation;
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
    ? Number(/^delivery-control\/r([1-9]\d*)$/u.exec(id)?.[1])
    : Number.NaN;
}

interface PendingProjectStatusWrite {
  readonly commentId: number;
  readonly workNumber: number;
  readonly authorityId: number;
  readonly commandDigest: string;
}

interface ReservationBody {
  readonly reservationId: string;
  readonly candidate: MergeCandidate;
  readonly state: MergeReservationState;
}

function parseReservation(
  value: unknown,
  revision: number,
  candidateHeadSha: string,
  embedded: boolean,
): ReservationBody {
  const body = value as {
    readonly reservationId?: unknown;
    readonly candidate?: unknown;
    readonly state?: unknown;
  } | null;
  const id = body?.reservationId;
  const origin = reservationRevision(id);
  if (
    typeof id !== "string" ||
    !Number.isSafeInteger(origin) ||
    origin > revision ||
    !isWorkIntegrationCandidate(body?.candidate) ||
    body.candidate.headSha !== candidateHeadSha ||
    !isReservationState(body.state) ||
    (!embedded && (body.state.phase === "reserved") !== (origin === revision))
  ) {
    throw new Error("MERGE_JOURNAL_RESERVATION_UNVERIFIED");
  }

  return { reservationId: id, candidate: body.candidate, state: body.state };
}

function isPendingProjectStatusWrite(
  value: unknown,
): value is PendingProjectStatusWrite {
  if (!value || typeof value !== "object") {
    return false;
  }
  const intent = value as Record<string, unknown>;
  return (
    Object.keys(intent).length === 4 &&
    checkId(intent["commentId"]) &&
    checkId(intent["workNumber"]) &&
    checkId(intent["authorityId"]) &&
    typeof intent["commandDigest"] === "string" &&
    digest.test(intent["commandDigest"])
  );
}

export function createGitHubWorkReservationJournal(
  connection: JournalConnection,
) {
  async function readTail() {
    const tail = await readMergeJournalTail(connection);
    if (!tail) {
      return null;
    }

    const body = JSON.parse(tail.body) as {
      readonly kind?: unknown;
      readonly pending?: unknown;
      readonly reservation?: unknown;
    } | null;
    const position = { revision: tail.revision, tagSha: tail.tagSha };
    if (body?.kind !== "project-status") {
      return {
        position,
        candidateHeadSha: tail.candidateHeadSha,
        reservation: parseReservation(
          body,
          tail.revision,
          tail.candidateHeadSha,
          false,
        ),
        pending: null,
      };
    }

    if (body.pending !== null && !isPendingProjectStatusWrite(body.pending)) {
      throw new Error("PROJECT_STATUS_INTENT_UNVERIFIED");
    }
    return {
      position,
      candidateHeadSha: tail.candidateHeadSha,
      reservation:
        body.reservation === null
          ? null
          : parseReservation(
              body.reservation,
              tail.revision,
              tail.candidateHeadSha,
              true,
            ),
      pending: body.pending,
    };
  }

  async function read(): Promise<PersistedReservation | null> {
    const tail = await readTail();
    if (tail?.pending) {
      throw new Error("PROJECT_STATUS_WRITE_PENDING");
    }
    return tail?.reservation
      ? toReceipt(tail.position, tail.reservation)
      : null;
  }

  async function appendEntry(
    previous: MergeJournalPosition | null,
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
    return result.status === "committed"
      ? { ...result.position, reservationId, reservation }
      : null;
  }

  return {
    read,

    async readProjectStatusBoundary() {
      const tail = await readTail();
      return {
        position: tail?.position ?? null,
        reservation: tail?.reservation
          ? toReceipt(tail.position, tail.reservation)
          : null,
        pending: tail?.pending ?? null,
      };
    },

    async beginProjectStatusWrite(input: {
      readonly previous: MergeJournalPosition | null;
      readonly workflowSha: string;
      readonly intent: PendingProjectStatusWrite;
    }): Promise<MergeJournalPosition | null> {
      if (
        !sha.test(input.workflowSha) ||
        !isPendingProjectStatusWrite(input.intent)
      ) {
        return null;
      }
      const tail = await readTail();
      if (
        tail?.pending ||
        !isDeepStrictEqual(input.previous, tail?.position ?? null)
      ) {
        return null;
      }
      const result = await appendMergeJournalRevision({
        ...connection,
        previous: tail?.position ?? null,
        candidateHeadSha:
          tail?.reservation?.candidate.headSha ?? input.workflowSha,
        body: JSON.stringify({
          kind: "project-status",
          pending: input.intent,
          reservation: tail?.reservation ?? null,
        }),
      });
      return result.status === "committed" ? result.position : null;
    },

    // Clear only after a known unstarted write or the exact observed outcome.
    async finishProjectStatusWrite(
      position: MergeJournalPosition,
      intent: PendingProjectStatusWrite,
    ): Promise<boolean> {
      const tail = await readTail();
      if (
        !tail?.pending ||
        !isDeepStrictEqual(position, tail.position) ||
        !isDeepStrictEqual(intent, tail.pending)
      ) {
        return false;
      }
      const result = await appendMergeJournalRevision({
        ...connection,
        previous: tail.position,
        candidateHeadSha: tail.candidateHeadSha,
        body: JSON.stringify({
          kind: "project-status",
          pending: null,
          reservation: tail.reservation,
        }),
      });
      return result.status === "committed";
    },

    async reserve(
      candidate: MergeCandidate,
    ): Promise<PersistedReservation | null> {
      if (!isWorkIntegrationCandidate(candidate)) {
        return null;
      }
      const tail = await readTail();
      if (tail?.pending) {
        return null;
      }
      const previous = tail?.reservation;
      if (previous) {
        const phase = previous.state.phase;
        if (
          phase !== "cancelled" &&
          phase !== "merged" &&
          phase !== "invalidated"
        ) {
          return sameWorkIntegrationCandidate(candidate, previous.candidate)
            ? toReceipt(tail.position, previous)
            : null;
        }
        if (sameWorkIntegrationCandidate(candidate, previous.candidate)) {
          return null;
        }
      }

      return appendEntry(
        tail?.position ?? null,
        { candidate, state: { phase: "reserved" } },
        `delivery-control/r${(tail?.position.revision ?? 0) + 1}`,
      );
    },

    async append(
      previous: WorkIntegrationReservationReceipt,
      reservation: MergeReservation,
    ): Promise<PersistedReservation | null> {
      const tail = await read();
      if (
        tail?.revision !== previous.revision ||
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

function toReceipt(
  position: MergeJournalPosition,
  body: ReservationBody,
): PersistedReservation {
  const { reservationId, candidate, state } = body;
  return { ...position, reservationId, reservation: { candidate, state } };
}
