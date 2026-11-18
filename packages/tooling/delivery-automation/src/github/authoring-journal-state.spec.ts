import { describe, expect, it } from "vitest";

import {
  prepareAuthoringRequest,
  projectAuthoringIntent,
} from "../control/authoring-request.js";
import {
  authoringScopesOverlap,
  decodeAuthoringJournalState,
  pendingAuthoringAffects,
} from "./authoring-journal-state.js";

function fixture() {
  const request = prepareAuthoringRequest({
    authenticatedSubject: "agent:fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey: "28df4e21-8049-4f84-9ec3-0ad22f2ca174",
      command: {
        kind: "edit-work",
        beforeStateDigest: "b".repeat(64),
        payloadDigest: "a".repeat(64),
      },
    },
  });
  if (!request) {
    throw new Error("Expected request");
  }
  const intent = projectAuthoringIntent({
    request,
    authorityDigest: "e".repeat(64),
    scope: {
      repositoryId: 1336937640,
      kind: "edit-work",
      affectedWorks: [140],
      affectedPulls: [147],
      affectedRefs: ["refs/heads/codex/work-140"],
    },
  });
  if (!intent) {
    throw new Error("Expected intent");
  }
  const pending = { intent, admissionRevision: 1 };
  return {
    intent,
    pending,
    state: {
      kind: "authoring",
      schema: 1,
      reservation: null,
      native: null,
      pending: null,
      authoring: [pending],
      event: { ...pending, outcome: "admitted", proofDigest: null },
    },
  };
}

describe("bounded authoring journal envelope", () => {
  it("decodes a minimized admission and each explicit terminal outcome", () => {
    const f = fixture();
    expect(decodeAuthoringJournalState(f.state, 1).authoring).toEqual([
      f.pending,
    ]);
    for (const outcome of ["confirmed", "known-unstarted", "not-applied"]) {
      expect(
        decodeAuthoringJournalState(
          {
            ...f.state,
            authoring: [],
            event: { ...f.pending, outcome, proofDigest: "d".repeat(64) },
          },
          2,
        ).event?.outcome,
      ).toBe(outcome);
    }
  });

  it("compares intent data independently of JSON key insertion order", () => {
    const f = fixture();
    const reordered = Object.fromEntries(Object.entries(f.intent).reverse());
    expect(
      decodeAuthoringJournalState(
        { ...f.state, event: { ...f.state.event, intent: reordered } },
        1,
      ).authoring,
    ).toEqual([f.pending]);
  });

  it.each([
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      event: { ...f.state.event, payload: "private" },
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      privateProjection: "private",
    }),
    (f: ReturnType<typeof fixture>) => ({ ...f.state, schema: 2 }),
    (f: ReturnType<typeof fixture>) => ({ ...f.state, authoring: null }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      authoring: [{ ...f.pending, admissionRevision: 0 }],
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      authoring: [{ ...f.pending, admissionRevision: 2 }],
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      authoring: [
        { ...f.pending, intent: { ...f.intent, payload: "private" } },
      ],
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      event: { ...f.state.event, proofDigest: "d".repeat(64) },
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      event: { ...f.state.event, outcome: "unknown" },
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      native: { counter: 1, journalRevision: 1 },
    }),
    (f: ReturnType<typeof fixture>) => ({ ...f.state, reservation: {} }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      reservation: {},
      native: { counter: 2, journalRevision: 1 },
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      reservation: {},
      native: { counter: 1, journalRevision: 2 },
    }),
    (f: ReturnType<typeof fixture>) => ({
      ...f.state,
      reservation: {},
      native: { counter: 1, journalRevision: 1, extra: true },
    }),
  ])(
    "rejects unknown fields, private payload, invalid identity and impossible versions",
    (change) => {
      expect(() => decodeAuthoringJournalState(change(fixture()), 1)).toThrow();
    },
  );

  it("rejects duplicate IDs, a mismatched admission and a terminal still marked pending", () => {
    const f = fixture();
    expect(() =>
      decodeAuthoringJournalState(
        { ...f.state, authoring: [f.pending, f.pending] },
        1,
      ),
    ).toThrow("DUPLICATE_INTENT");
    expect(() =>
      decodeAuthoringJournalState(
        {
          ...f.state,
          event: {
            ...f.state.event,
            intent: { ...f.intent, commandDigest: "d".repeat(64) },
          },
        },
        1,
      ),
    ).toThrow("EVENT_UNVERIFIED");
    expect(() =>
      decodeAuthoringJournalState(
        {
          ...f.state,
          event: {
            ...f.pending,
            outcome: "confirmed",
            proofDigest: "d".repeat(64),
          },
        },
        2,
      ),
    ).toThrow("EVENT_UNVERIFIED");
    expect(() =>
      decodeAuthoringJournalState(
        {
          ...f.state,
          authoring: [],
          event: { ...f.pending, outcome: "confirmed", proofDigest: null },
        },
        2,
      ),
    ).toThrow();
  });
});

describe("scoped authoring conflict checks", () => {
  it("allows complete independent scope and blocks each concrete intersection", () => {
    const { intent } = fixture();
    const other = {
      ...intent.scope,
      affectedWorks: [999],
      affectedPulls: [998],
      affectedRefs: ["refs/heads/independent"],
    };
    expect(authoringScopesOverlap(intent.scope, other)).toBe(false);
    expect(
      authoringScopesOverlap(intent.scope, { ...other, affectedWorks: [140] }),
    ).toBe(true);
    expect(
      authoringScopesOverlap(intent.scope, { ...other, affectedPulls: [147] }),
    ).toBe(true);
    expect(
      authoringScopesOverlap(intent.scope, {
        ...other,
        affectedRefs: [...intent.scope.affectedRefs],
      }),
    ).toBe(true);
  });

  it("fails closed for unknown targets and governs the integration base", () => {
    const { pending, intent } = fixture();
    expect(pendingAuthoringAffects({ pending: [] })).toBe(false);
    expect(pendingAuthoringAffects({ pending: [pending] })).toBe(true);
    expect(pendingAuthoringAffects({ pending: [pending], workNumber: 0 })).toBe(
      true,
    );
    expect(
      pendingAuthoringAffects({
        pending: [pending],
        workNumber: 999,
        pullNumber: 0,
      }),
    ).toBe(true);
    expect(
      pendingAuthoringAffects({ pending: [pending], workNumber: 140 }),
    ).toBe(true);
    expect(
      pendingAuthoringAffects({ pending: [pending], workNumber: 999 }),
    ).toBe(false);
    expect(
      pendingAuthoringAffects({
        pending: [pending],
        workNumber: 999,
        pullNumber: 147,
      }),
    ).toBe(true);
    expect(
      pendingAuthoringAffects({
        pending: [
          {
            ...pending,
            intent: {
              ...intent,
              scope: { ...intent.scope, affectedRefs: ["refs/heads/main"] },
            },
          },
        ],
        workNumber: 999,
      }),
    ).toBe(true);
  });
});
