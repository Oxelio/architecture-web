import {
  isPublicAuthoringIntent,
  type PublicAuthoringIntent,
} from "../control/authoring-request.js";
import type { ControlledWriteScope } from "../control/controlled-write.js";

export interface NativeJournalVersion {
  readonly counter: number;
  readonly journalRevision: number;
}

export interface PendingAuthoringIntent {
  readonly intent: PublicAuthoringIntent;
  readonly admissionRevision: number;
}

export type AuthoringTerminalOutcome =
  "confirmed" | "known-unstarted" | "not-applied";
const terminalOutcomes = new Set<AuthoringTerminalOutcome>([
  "confirmed",
  "known-unstarted",
  "not-applied",
]);

export function isAuthoringTerminalOutcome(
  value: unknown,
): value is AuthoringTerminalOutcome {
  return (
    typeof value === "string" &&
    terminalOutcomes.has(value as AuthoringTerminalOutcome)
  );
}

export interface AuthoringJournalEvent extends PendingAuthoringIntent {
  readonly outcome: "admitted" | AuthoringTerminalOutcome;
  readonly proofDigest: string | null;
}

// Native reservation and Status payload validation remains with their existing
// owner. This codec owns only the bounded authoring envelope and public intent.
export interface AuthoringJournalState {
  readonly kind: "authoring";
  readonly schema: 1;
  readonly reservation: unknown;
  readonly native: NativeJournalVersion | null;
  readonly pending: unknown;
  readonly authoring: readonly PendingAuthoringIntent[];
  readonly event: AuthoringJournalEvent | null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function keys(value: Record<string, unknown>, expected: readonly string[]) {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function revision(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}

function isPending(
  value: unknown,
  maximum: number,
): value is PendingAuthoringIntent {
  const item = object(value);
  return (
    item !== null &&
    keys(item, ["intent", "admissionRevision"]) &&
    isPublicAuthoringIntent(item["intent"]) &&
    revision(item["admissionRevision"], maximum)
  );
}

function isEvent(
  value: unknown,
  maximum: number,
): value is AuthoringJournalEvent {
  const item = object(value);
  if (
    !item ||
    !keys(item, ["intent", "admissionRevision", "outcome", "proofDigest"]) ||
    !isPublicAuthoringIntent(item["intent"]) ||
    !revision(item["admissionRevision"], maximum)
  ) {
    return false;
  }
  if (item["outcome"] === "admitted") {
    return (
      item["admissionRevision"] === maximum && item["proofDigest"] === null
    );
  }
  return (
    isAuthoringTerminalOutcome(item["outcome"]) &&
    item["admissionRevision"] < maximum &&
    typeof item["proofDigest"] === "string" &&
    /^[a-f0-9]{64}$/u.test(item["proofDigest"])
  );
}

function isNativeVersion(
  value: unknown,
  maximum: number,
): value is NativeJournalVersion {
  const item = object(value);
  return (
    item !== null &&
    keys(item, ["counter", "journalRevision"]) &&
    revision(item["journalRevision"], maximum) &&
    revision(item["counter"], item["journalRevision"])
  );
}

export function decodeAuthoringJournalState(
  value: unknown,
  globalRevision: number,
): AuthoringJournalState {
  const item = object(value);
  if (
    !revision(globalRevision, Number.MAX_SAFE_INTEGER) ||
    !item ||
    !keys(item, [
      "kind",
      "schema",
      "reservation",
      "native",
      "pending",
      "authoring",
      "event",
    ]) ||
    item["kind"] !== "authoring" ||
    item["schema"] !== 1 ||
    (item["native"] !== null &&
      !isNativeVersion(item["native"], globalRevision)) ||
    (item["reservation"] === null) !== (item["native"] === null) ||
    !Array.isArray(item["authoring"]) ||
    !item["authoring"].every((entry) => isPending(entry, globalRevision)) ||
    (item["event"] !== null && !isEvent(item["event"], globalRevision))
  ) {
    throw new TypeError("AUTHORING_JOURNAL_STATE_UNVERIFIED");
  }
  const state = item as unknown as AuthoringJournalState;
  if (
    new Set(state.authoring.map(({ intent }) => intent.requestId)).size !==
    state.authoring.length
  ) {
    throw new TypeError("AUTHORING_JOURNAL_DUPLICATE_INTENT");
  }
  const event = state.event;
  if (event) {
    const pending = state.authoring.find(
      ({ intent }) => intent.requestId === event.intent.requestId,
    );
    if (
      event.outcome === "admitted"
        ? !pending ||
          !isDeepStrictEqual(pending, {
            intent: event.intent,
            admissionRevision: event.admissionRevision,
          })
        : pending !== undefined
    ) {
      throw new TypeError("AUTHORING_JOURNAL_EVENT_UNVERIFIED");
    }
  }
  return state;
}

export function authoringScopesOverlap(
  first: ControlledWriteScope,
  second: ControlledWriteScope,
) {
  return (
    first.affectedWorks.some((id) => second.affectedWorks.includes(id)) ||
    first.affectedPulls.some((id) => second.affectedPulls.includes(id)) ||
    first.affectedRefs.some((ref) => second.affectedRefs.includes(ref))
  );
}

// Scope is resolved completely by trusted composition before admission.
// An unknown target cannot be treated as independent of a pending write.
export function pendingAuthoringAffects(input: {
  readonly pending: readonly PendingAuthoringIntent[];
  readonly workNumber?: number;
  readonly pullNumber?: number;
}) {
  if (!input.pending.length) {
    return false;
  }
  if (!Number.isSafeInteger(input.workNumber) || (input.workNumber ?? 0) <= 0) {
    return true;
  }
  if (
    input.pullNumber !== undefined &&
    (!Number.isSafeInteger(input.pullNumber) || input.pullNumber <= 0)
  ) {
    return true;
  }
  return input.pending.some(
    ({ intent }) =>
      intent.scope.affectedWorks.includes(input.workNumber as number) ||
      (input.pullNumber !== undefined &&
        intent.scope.affectedPulls.includes(input.pullNumber)) ||
      intent.scope.affectedRefs.includes("refs/heads/main"),
  );
}
import { isDeepStrictEqual } from "node:util";
