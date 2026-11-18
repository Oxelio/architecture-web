import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  type PreparedAuthoringRequest,
  projectAuthoringIntent,
  type PublicAuthoringIntent,
} from "../control/authoring-request.js";
import {
  type ControlledWriteScope,
  isControlledWriteScope,
  planControlledWrite,
  type ReservedWriteContext,
} from "../control/controlled-write.js";
import type {
  MergeReservation,
  MergeReservationState,
} from "../control/merge-reservation.js";
import type { WorkIntegrationReservationReceipt } from "../control/work-integration-controller.js";
import {
  isWorkIntegrationCandidate,
  sameWorkIntegrationCandidate,
} from "../control/work-integration-request.js";
import {
  type AuthoringJournalEvent,
  authoringScopesOverlap,
  type AuthoringTerminalOutcome,
  decodeAuthoringJournalState,
  isAuthoringTerminalOutcome,
  type NativeJournalVersion,
  pendingAuthoringAffects,
  type PendingAuthoringIntent,
} from "./authoring-journal-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import {
  appendMergeJournalRevision,
  type MergeJournalPosition,
  readMergeJournalRevision,
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

interface AdmissionContext {
  readonly enabled?: boolean;
  readonly previous: MergeJournalPosition | null;
  readonly workflowSha: string;
  readonly inventoryComplete: boolean;
  readonly reserved: ReservedWriteContext | null;
  readonly maximumHistoryRevisions: number;
  readonly readAuthority: () => Promise<string | null>;
}

type SonarJournalKind =
  "sonar-submit" | "sonar-queue-check" | "sonar-complete-check";

function sonarJournalDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function protectedSonarJournalRequestId(
  candidate: MergeCandidate,
  kind: SonarJournalKind,
  operationId: string,
) {
  return sonarJournalDigest([
    "protected-sonar-operation",
    1336937640,
    candidate.workNumber,
    candidate.pullNumber,
    candidate.headSha,
    candidate.baseSha,
    kind,
    operationId,
  ]);
}

// The trusted manual check writer runs in the shared protected Actions group.
// Keep that writer out until the native reservation has conclusively ended.
export async function canPublishManualWorkGate(
  connection: JournalConnection,
  workNumber?: number,
) {
  const { pending, reservation: entry } =
    await createGitHubWorkReservationJournal(
      connection,
    ).readProjectStatusBoundary(workNumber);
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
    ).readProjectStatusBoundary(workNumber);
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

interface PersistedReservation extends WorkIntegrationReservationReceipt {
  readonly reservationId: string;
  // This identifies the native version source. Global CAS uses boundary.position.
  readonly nativePosition: MergeJournalPosition;
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

type JournalEntry = NonNullable<
  Awaited<ReturnType<typeof readMergeJournalTail>>
>;

interface JournalSnapshot {
  readonly position: MergeJournalPosition;
  readonly candidateHeadSha: string;
  readonly reservation: ReservationBody | null;
  readonly native: NativeJournalVersion | null;
  readonly nativePosition: MergeJournalPosition | null;
  readonly pending: PendingProjectStatusWrite | null;
  readonly authoring: readonly PendingAuthoringIntent[];
  readonly event: AuthoringJournalEvent | null;
  readonly extended: boolean;
}

interface AuthoringHistoryReceipt extends AuthoringJournalEvent {
  readonly position: MergeJournalPosition;
}

type AuthoringAdmissionResult =
  | {
      readonly status:
        | "inactive"
        | "denied"
        | "deferred"
        | "pending"
        | "settled"
        | "conflict"
        | "cancel-or-resolve"
        | "recover-merged";
    }
  | {
      readonly status: "admitted";
      readonly admission: PendingAuthoringIntent;
      readonly position: MergeJournalPosition;
    };

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

function parseJournalSnapshot(tail: JournalEntry): JournalSnapshot {
  const body = JSON.parse(tail.body) as {
    readonly kind?: unknown;
    readonly pending?: unknown;
    readonly reservation?: unknown;
  } | null;
  const position = { revision: tail.revision, tagSha: tail.tagSha };
  const extended =
    body?.kind === "authoring"
      ? decodeAuthoringJournalState(body, tail.revision)
      : null;
  if (body?.kind !== undefined && body.kind !== "project-status" && !extended) {
    throw new Error("MERGE_JOURNAL_KIND_UNVERIFIED");
  }
  const embedded = body?.kind === "project-status" || extended !== null;
  const pending = embedded ? body?.pending : null;
  if (pending !== null && !isPendingProjectStatusWrite(pending)) {
    throw new Error("PROJECT_STATUS_INTENT_UNVERIFIED");
  }
  const reservation =
    embedded && body?.reservation === null
      ? null
      : parseReservation(
          embedded ? body?.reservation : body,
          tail.revision,
          tail.candidateHeadSha,
          embedded,
        );
  const native = extended
    ? extended.native
    : reservation
      ? { counter: tail.revision, journalRevision: tail.revision }
      : null;
  return {
    position,
    candidateHeadSha: tail.candidateHeadSha,
    reservation,
    native,
    nativePosition: native?.journalRevision === tail.revision ? position : null,
    pending,
    authoring: extended?.authoring ?? [],
    event: extended?.event ?? null,
    extended: extended !== null,
  };
}

function verifyAuthoringIntents(
  previous: JournalSnapshot | null,
  current: JournalSnapshot,
) {
  if (!current.extended) {
    if (previous?.extended) {
      throw new Error("AUTHORING_JOURNAL_PROTOCOL_DOWNGRADE");
    }
    return;
  }
  if (current.pending && current.authoring.length) {
    throw new Error("AUTHORING_STATUS_OVERLAP_UNVERIFIED");
  }
  const event = current.event;
  const before = previous?.authoring ?? [];
  const found = event
    ? before.find(({ intent }) => intent.requestId === event.intent.requestId)
    : undefined;
  let expected = [...before];
  if (event?.outcome === "admitted") {
    if (found) {
      throw new Error("AUTHORING_JOURNAL_REPLAY");
    }
    expected.push({
      intent: event.intent,
      admissionRevision: event.admissionRevision,
    });
  } else if (event) {
    if (
      !found ||
      !isDeepStrictEqual(found, {
        intent: event.intent,
        admissionRevision: event.admissionRevision,
      })
    ) {
      throw new Error("AUTHORING_SETTLEMENT_UNVERIFIED");
    }
    expected = expected.filter(
      ({ intent }) => intent.requestId !== event.intent.requestId,
    );
  }
  if (!isDeepStrictEqual(expected, current.authoring)) {
    throw new Error("AUTHORING_JOURNAL_INTENT_DISCONTINUITY");
  }
}

function verifyNativeContinuation(
  previous: JournalSnapshot | null,
  current: JournalSnapshot,
) {
  if (current.native?.journalRevision === current.position.revision) {
    const sameReservation =
      previous?.reservation?.reservationId ===
      current.reservation?.reservationId;
    const expectedCounter =
      sameReservation && previous?.native
        ? previous.native.counter + 1
        : current.position.revision;
    if (current.native.counter !== expectedCounter || current.event) {
      throw new Error("NATIVE_VERSION_INCREMENT_UNVERIFIED");
    }
  } else if (
    !isDeepStrictEqual(previous?.native ?? null, current.native) ||
    !isDeepStrictEqual(previous?.reservation ?? null, current.reservation)
  ) {
    throw new Error("NATIVE_VERSION_CARRY_UNVERIFIED");
  }
}

function verifyAuthoringContinuation(
  previous: JournalSnapshot | null,
  current: JournalSnapshot,
) {
  verifyAuthoringIntents(previous, current);
  if (!current.extended) {
    return;
  }
  verifyNativeContinuation(previous, current);
  if (
    current.event &&
    !isDeepStrictEqual(previous?.pending ?? null, current.pending)
  ) {
    throw new Error("AUTHORING_STATUS_TRANSITION_UNVERIFIED");
  }
}

function validatedAuthoringHistory(
  found: readonly AuthoringHistoryReceipt[],
  tail: JournalSnapshot,
  requestId: string,
): AuthoringHistoryReceipt | null {
  const ordered = [...found].reverse();
  const first = ordered[0];
  const last = ordered.at(-1);
  if (
    ordered.length > 2 ||
    (first &&
      (first.outcome !== "admitted" ||
        first.admissionRevision !== first.position.revision))
  ) {
    throw new Error("AUTHORING_HISTORY_REPLAY");
  }
  if (
    ordered.length === 2 &&
    (!last ||
      last.outcome === "admitted" ||
      !isDeepStrictEqual(last.intent, first?.intent) ||
      last.admissionRevision !== first?.admissionRevision)
  ) {
    throw new Error("AUTHORING_HISTORY_OUTCOME_UNVERIFIED");
  }
  const pending = tail.authoring.find(
    ({ intent }) => intent.requestId === requestId,
  );
  if (
    last?.outcome === "admitted"
      ? !pending ||
        !isDeepStrictEqual(pending, {
          intent: last.intent,
          admissionRevision: last.admissionRevision,
        })
      : pending !== undefined
  ) {
    throw new Error("AUTHORING_HISTORY_PENDING_UNVERIFIED");
  }
  return last ?? null;
}

function authoringReplayStatus(
  seen: AuthoringHistoryReceipt,
  intent: AuthoringHistoryReceipt["intent"],
): "conflict" | "pending" | "settled" {
  if (!isDeepStrictEqual(seen.intent, intent)) {
    return "conflict";
  }
  return seen.outcome === "admitted" ? "pending" : "settled";
}

async function verifiedNativePosition(
  current: JournalSnapshot,
  load: (revision: number) => Promise<JournalEntry | null>,
) {
  if (!current.native || current.nativePosition) {
    return current.nativePosition;
  }
  const source = await load(current.native.journalRevision);
  const parsed = source ? parseJournalSnapshot(source) : null;
  if (
    !parsed ||
    !parsed.native ||
    parsed.native.journalRevision !== source?.revision ||
    parsed.native.counter !== current.native.counter ||
    !isDeepStrictEqual(parsed.reservation, current.reservation)
  ) {
    throw new Error("NATIVE_VERSION_SOURCE_UNVERIFIED");
  }
  return parsed.position;
}

async function verifyAuthoringSources(
  current: JournalSnapshot,
  load: (revision: number) => Promise<JournalEntry | null>,
) {
  for (const pending of current.authoring) {
    const source = await load(pending.admissionRevision);
    const event = source ? parseJournalSnapshot(source).event : null;
    if (
      !event ||
      event.outcome !== "admitted" ||
      !isDeepStrictEqual(
        { intent: event.intent, admissionRevision: event.admissionRevision },
        pending,
      )
    ) {
      throw new Error("AUTHORING_ADMISSION_SOURCE_UNVERIFIED");
    }
  }
}

export function createGitHubWorkReservationJournal(
  connection: JournalConnection,
) {
  async function readTail(): Promise<JournalSnapshot | null> {
    const entry = await readMergeJournalTail(connection);
    if (!entry) {
      return null;
    }
    const cache = new Map<number, Promise<JournalEntry | null>>();
    cache.set(entry.revision, Promise.resolve(entry));
    const load = (revision: number) => {
      let request = cache.get(revision);
      if (!request) {
        request = readMergeJournalRevision({ ...connection, revision });
        cache.set(revision, request);
      }
      return request;
    };
    const current = parseJournalSnapshot(entry);
    const preceding =
      entry.revision > 1 ? await load(entry.revision - 1) : null;
    if ((preceding?.tagSha ?? null) !== entry.previous) {
      throw new Error("MERGE_JOURNAL_PREDECESSOR_UNVERIFIED");
    }
    verifyAuthoringContinuation(
      preceding ? parseJournalSnapshot(preceding) : null,
      current,
    );
    const nativePosition = await verifiedNativePosition(current, load);
    await verifyAuthoringSources(current, load);
    return { ...current, nativePosition };
  }

  function toReceipt(tail: JournalSnapshot): PersistedReservation {
    if (!tail.reservation || !tail.native || !tail.nativePosition) {
      throw new Error("NATIVE_VERSION_MISSING");
    }
    const { reservationId, candidate, state } = tail.reservation;
    return {
      revision: tail.native.counter,
      nativePosition: { ...tail.nativePosition },
      reservationId,
      reservation: { candidate, state },
    };
  }

  function nativeReceipt(
    tail: JournalSnapshot | null,
  ): PersistedReservation | null {
    if (tail?.pending) {
      throw new Error("PROJECT_STATUS_WRITE_PENDING");
    }
    if (
      tail?.reservation &&
      pendingAuthoringAffects({
        pending: tail.authoring,
        workNumber: tail.reservation.candidate.workNumber,
        pullNumber: tail.reservation.candidate.pullNumber,
      })
    ) {
      throw new Error("AUTHORING_WRITE_PENDING");
    }
    return tail?.reservation ? toReceipt(tail) : null;
  }

  async function read(): Promise<PersistedReservation | null> {
    return nativeReceipt(await readTail());
  }

  function extendedBody(
    tail: JournalSnapshot,
    changes: Partial<
      Pick<
        JournalSnapshot,
        "reservation" | "native" | "pending" | "authoring" | "event"
      >
    > = {},
  ) {
    const state = { ...tail, ...changes };
    return JSON.stringify({
      kind: "authoring",
      schema: 1,
      reservation: state.reservation,
      native: state.native,
      pending: state.pending,
      authoring: state.authoring,
      event: state.event,
    });
  }

  async function appendEntry(
    previous: JournalSnapshot | null,
    reservation: MergeReservation,
    reservationId: string,
  ): Promise<PersistedReservation | null> {
    const { candidate, state } = reservation;
    const revision = (previous?.position.revision ?? 0) + 1;
    const counter =
      previous?.extended &&
      previous.reservation?.reservationId === reservationId &&
      previous.native
        ? previous.native.counter + 1
        : revision;
    const body = { reservationId, candidate, state };
    const result = await appendMergeJournalRevision({
      ...connection,
      previous: previous?.position ?? null,
      candidateHeadSha: candidate.headSha,
      body: previous?.extended
        ? extendedBody(previous, {
            reservation: body,
            native: { counter, journalRevision: revision },
            event: null,
          })
        : JSON.stringify(body),
    });
    return result.status === "committed"
      ? {
          revision: counter,
          nativePosition: result.position,
          reservationId,
          reservation,
        }
      : null;
  }

  async function authoringHistory(
    requestId: string,
    maximumRevisions: number,
    tail: JournalSnapshot | null,
  ): Promise<AuthoringHistoryReceipt | null> {
    if (
      !digest.test(requestId) ||
      !Number.isSafeInteger(maximumRevisions) ||
      maximumRevisions <= 0
    ) {
      throw new Error("AUTHORING_HISTORY_INPUT_UNVERIFIED");
    }
    if (!tail) {
      return null;
    }
    if (tail.position.revision > maximumRevisions) {
      throw new Error("AUTHORING_HISTORY_INCOMPLETE");
    }
    let expectedSha: string | null = tail.position.tagSha;
    const found: AuthoringHistoryReceipt[] = [];
    for (let revision = tail.position.revision; revision > 0; revision--) {
      const entry = await readMergeJournalRevision({ ...connection, revision });
      if (!entry || entry.tagSha !== expectedSha) {
        throw new Error("AUTHORING_HISTORY_CHAIN_UNVERIFIED");
      }
      const snapshot = parseJournalSnapshot(entry);
      if (snapshot.event?.intent.requestId === requestId) {
        found.push({ ...snapshot.event, position: snapshot.position });
      }
      expectedSha = entry.previous;
    }
    return validatedAuthoringHistory(found, tail, requestId);
  }

  async function appendAuthoringEvent(
    tail: JournalSnapshot | null,
    workflowSha: string,
    authoring: readonly PendingAuthoringIntent[],
    event: AuthoringJournalEvent,
  ) {
    return appendMergeJournalRevision({
      ...connection,
      previous: tail?.position ?? null,
      candidateHeadSha: tail?.reservation?.candidate.headSha ?? workflowSha,
      body: JSON.stringify({
        kind: "authoring",
        schema: 1,
        reservation: tail?.reservation ?? null,
        native: tail?.native ?? null,
        pending: tail?.pending ?? null,
        authoring,
        event,
      }),
    });
  }

  async function beginWrite(
    input: AdmissionContext,
    intent: PublicAuthoringIntent,
  ): Promise<AuthoringAdmissionResult> {
    if (!sha.test(input.workflowSha)) {
      return { status: "denied" };
    }
    const reserved = input.reserved ? structuredClone(input.reserved) : null;
    try {
      const tail = await readTail();
      if (
        !isDeepStrictEqual(input.previous, tail?.position ?? null) ||
        !isDeepStrictEqual(
          reserved?.reservation ?? null,
          tail?.reservation
            ? {
                candidate: tail.reservation.candidate,
                state: tail.reservation.state,
              }
            : null,
        )
      ) {
        return { status: "deferred" };
      }
      const seen = await authoringHistory(
        intent.requestId,
        input.maximumHistoryRevisions,
        tail,
      );
      if (seen) {
        return { status: authoringReplayStatus(seen, intent) };
      }
      const plan = planControlledWrite({
        enabled: true,
        scope: intent.scope,
        inventoryComplete: input.inventoryComplete,
        writePending:
          Boolean(tail?.pending) ||
          (tail?.authoring.some((entry) =>
            authoringScopesOverlap(entry.intent.scope, intent.scope),
          ) ??
            false),
        reserved,
      });
      if (plan === "cancel-or-resolve" || plan === "recover-merged") {
        return { status: plan };
      }
      if (
        plan !== "admit" ||
        (await input.readAuthority()) !== intent.authorityDigest
      ) {
        return { status: "deferred" };
      }
      const admission = {
        intent,
        admissionRevision: (tail?.position.revision ?? 0) + 1,
      };
      const result = await appendAuthoringEvent(
        tail,
        input.workflowSha,
        [...(tail?.authoring ?? []), admission],
        { ...admission, outcome: "admitted", proofDigest: null },
      );
      if (
        result.status !== "committed" ||
        (await input.readAuthority()) !== intent.authorityDigest
      ) {
        return { status: "deferred" };
      }
      return { status: "admitted", admission, position: result.position };
    } catch {
      return { status: "deferred" };
    }
  }

  return {
    read,

    async readAuthoringRequest(requestId: string, maximumRevisions: number) {
      return authoringHistory(requestId, maximumRevisions, await readTail());
    },

    // A matching history read after a lost response never grants a replacement
    // executor permission to repeat the provider or repository operation.
    async beginAuthoringWrite(
      input: AdmissionContext & {
        readonly request: PreparedAuthoringRequest;
        readonly scope: ControlledWriteScope;
        readonly authorityDigest: string;
      },
    ): Promise<AuthoringAdmissionResult> {
      if (input.enabled !== true) {
        return { status: "inactive" };
      }
      const intent = projectAuthoringIntent(input);
      return intent ? beginWrite(input, intent) : { status: "denied" };
    },

    // Internal to the protected producer/publisher. None of these verbs is
    // accepted by the authoring intake. Scope comes from canonical owners.
    async beginProtectedSonarOperation(
      input: AdmissionContext & {
        readonly candidate: MergeCandidate;
        readonly operation: SonarJournalKind;
        readonly operationId: string;
        readonly evidenceDigest: string;
        readonly authorityDigest: string;
        readonly scope: ControlledWriteScope;
      },
    ): Promise<AuthoringAdmissionResult> {
      if (input.enabled !== true) {
        return { status: "inactive" };
      }
      const {
        candidate,
        operation,
        operationId,
        evidenceDigest,
        authorityDigest,
        scope,
      } = input;
      if (
        !isWorkIntegrationCandidate(candidate) ||
        !["sonar-submit", "sonar-queue-check", "sonar-complete-check"].includes(
          operation,
        ) ||
        ![operationId, evidenceDigest, authorityDigest].every((value) =>
          digest.test(value),
        ) ||
        !isControlledWriteScope(scope) ||
        scope.kind !== operation ||
        !scope.affectedWorks.includes(candidate.workNumber) ||
        !scope.affectedPulls.includes(candidate.pullNumber)
      ) {
        return { status: "denied" };
      }
      const requestId = protectedSonarJournalRequestId(
        candidate,
        operation,
        operationId,
      );
      return beginWrite(input, {
        schema: 1,
        requestId,
        actorDigest: sonarJournalDigest(["protected-sonar", 1336937640]),
        commandDigest: sonarJournalDigest([requestId, evidenceDigest]),
        authorityDigest,
        beforeStateDigest: evidenceDigest,
        scope: {
          ...scope,
          affectedWorks: [...scope.affectedWorks].sort((a, b) => a - b),
          affectedPulls: [...scope.affectedPulls].sort((a, b) => a - b),
          affectedRefs: [...scope.affectedRefs].sort((a, b) =>
            a.localeCompare(b),
          ),
        },
      });
    },

    // Observation is a trusted read-only proof adapter. A digest alone, a
    // lease timeout or absence of a remote object is not settlement evidence.
    async finishAuthoringWrite(input: {
      readonly enabled?: boolean;
      readonly requestId: string;
      readonly maximumHistoryRevisions: number;
      readonly authorizeRecovery: () => Promise<boolean>;
      readonly observeOutcome: (admission: PendingAuthoringIntent) => Promise<{
        readonly outcome: AuthoringTerminalOutcome;
        readonly proofDigest: string;
      } | null>;
    }): Promise<"inactive" | "deferred" | "settled" | "already-settled"> {
      if (input.enabled !== true) {
        return "inactive";
      }
      try {
        if (!(await input.authorizeRecovery())) {
          return "deferred";
        }
        const first = await readTail();
        const receipt = await authoringHistory(
          input.requestId,
          input.maximumHistoryRevisions,
          first,
        );
        if (!receipt) {
          return "deferred";
        }
        if (receipt.outcome !== "admitted") {
          return "already-settled";
        }
        const admission = {
          intent: receipt.intent,
          admissionRevision: receipt.admissionRevision,
        };
        const proof = await input.observeOutcome(admission);
        if (
          !proof ||
          !isAuthoringTerminalOutcome(proof.outcome) ||
          !digest.test(proof.proofDigest) ||
          !(await input.authorizeRecovery())
        ) {
          return "deferred";
        }
        const tail = await readTail();
        const current = tail?.authoring.find(
          ({ intent }) => intent.requestId === input.requestId,
        );
        if (!tail || !isDeepStrictEqual(current, admission)) {
          return "deferred";
        }
        if (!(await input.authorizeRecovery())) {
          return "deferred";
        }
        const result = await appendAuthoringEvent(
          tail,
          tail.candidateHeadSha,
          tail.authoring.filter(
            ({ intent }) => intent.requestId !== input.requestId,
          ),
          { ...admission, ...proof },
        );
        return result.status === "committed" ? "settled" : "deferred";
      } catch {
        return "deferred";
      }
    },

    async readProjectStatusBoundary(workNumber?: number) {
      const tail = await readTail();
      if (
        tail &&
        pendingAuthoringAffects({
          pending: tail.authoring,
          ...(workNumber !== undefined ? { workNumber } : {}),
        })
      ) {
        throw new Error("AUTHORING_WRITE_PENDING");
      }
      return {
        position: tail?.position ?? null,
        reservation: tail?.reservation ? toReceipt(tail) : null,
        pending: tail?.pending ?? null,
      };
    },

    async readAuthoringBoundary() {
      const tail = await readTail();
      return {
        position: tail?.position ?? null,
        reservation: tail?.reservation ? toReceipt(tail) : null,
        projectStatus: tail?.pending ?? null,
        authoring: tail?.authoring ?? [],
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
        tail?.authoring.length ||
        !isDeepStrictEqual(input.previous, tail?.position ?? null)
      ) {
        return null;
      }
      const result = await appendMergeJournalRevision({
        ...connection,
        previous: tail?.position ?? null,
        candidateHeadSha:
          tail?.reservation?.candidate.headSha ?? input.workflowSha,
        body: tail?.extended
          ? extendedBody(tail, { pending: input.intent, event: null })
          : JSON.stringify({
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
        body: tail.extended
          ? extendedBody(tail, { pending: null, event: null })
          : JSON.stringify({
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
      if (
        tail?.pending ||
        (tail &&
          pendingAuthoringAffects({
            pending: tail.authoring,
            workNumber: candidate.workNumber,
            pullNumber: candidate.pullNumber,
          }))
      ) {
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
            ? toReceipt(tail)
            : null;
        }
        if (sameWorkIntegrationCandidate(candidate, previous.candidate)) {
          return null;
        }
      }

      return appendEntry(
        tail,
        { candidate, state: { phase: "reserved" } },
        `delivery-control/r${(tail?.position.revision ?? 0) + 1}`,
      );
    },

    async append(
      previous: WorkIntegrationReservationReceipt,
      reservation: MergeReservation,
    ): Promise<PersistedReservation | null> {
      const snapshot = await readTail();
      const tail = nativeReceipt(snapshot);
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
      return appendEntry(snapshot, reservation, tail.reservationId);
    },
  };
}
