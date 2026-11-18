import { describe, expect, it } from "vitest";

import {
  classifyAuthoringReplay,
  prepareAuthoringRequest,
  type PreparedAuthoringRequest,
  projectAuthoringIntent,
} from "./authoring-request.js";

const subject = "agent:fixture";
const metadata = {
  beforeStateDigest: "b".repeat(64),
  payloadDigest: "a".repeat(64),
};
const commands = [
  {
    kind: "publish-commit",
    sourceRef: "refs/heads/codex/work-140",
    expectedHeadSha: "c".repeat(40),
    proposedHeadSha: "d".repeat(40),
    payloadDigest: metadata.payloadDigest,
  },
  {
    kind: "edit-pull-request",
    pullNumber: 147,
    headSha: "c".repeat(40),
    baseSha: "d".repeat(40),
    ...metadata,
  },
  { kind: "edit-work", ...metadata },
  { kind: "edit-task-dependency", taskNumber: 138, ...metadata },
  { kind: "record-evidence", ...metadata },
  {
    kind: "record-project-field",
    projectNumber: 3,
    itemId: "PVTI_fixture",
    fieldId: "PVTSSF_fixture",
    ...metadata,
  },
] as const;

function envelope(command: unknown = commands[0]) {
  return {
    schema: 1,
    repositoryId: 1336937640,
    workNumber: 140,
    clientKey: "28df4e21-8049-4f84-9ec3-0ad22f2ca174",
    command,
  };
}

function prepare(command: unknown = commands[0]) {
  const request = prepareAuthoringRequest({
    authenticatedSubject: subject,
    envelope: envelope(command),
  });
  if (!request) {
    throw new Error("Expected prepared fixture request");
  }
  return request;
}

function scope(request = prepare()) {
  return {
    repositoryId: 1336937640,
    kind: request.command.kind,
    affectedWorks: [140, 138],
    affectedPulls: [147],
    affectedRefs: ["refs/heads/main", "refs/heads/codex/work-140"],
  };
}

function receipt(request = prepare(), state = "pending") {
  return {
    schema: 1,
    requestId: request.requestId,
    actorDigest: request.actorDigest,
    commandDigest: request.commandDigest,
    state,
  };
}

describe("authoring metadata preparation", () => {
  it.each(commands)(
    "prepares fixed $kind metadata independently of JSON field order",
    (command) => {
      const request = prepare(command);
      const reordered = prepare(
        Object.fromEntries(Object.entries(command).reverse()),
      );
      expect(reordered).toEqual(request);
      expect(request.requestId).toMatch(/^[a-f0-9]{64}$/u);
      expect(request.commandDigest).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it("keeps retry identity while exposing changed command, Work or content", () => {
    const original = prepare();
    for (const change of [
      { ...envelope(), workNumber: 141 },
      envelope({ ...commands[0], payloadDigest: "e".repeat(64) }),
      envelope({ ...commands[0], proposedHeadSha: "e".repeat(40) }),
      envelope(commands[2]),
    ]) {
      const changed = prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: change,
      });
      if (!changed) {
        throw new Error("Expected changed fixture request");
      }
      expect(changed?.requestId).toBe(original.requestId);
      expect(changed?.commandDigest).not.toBe(original.commandDigest);
      expect(classifyAuthoringReplay(changed, receipt(original))).toBe(
        "conflict",
      );
    }
  });

  it("binds identity to authenticated subject and original client key", () => {
    const original = prepare();
    const otherSubject = prepareAuthoringRequest({
      authenticatedSubject: "agent:other",
      envelope: envelope(),
    });
    const otherKey = prepareAuthoringRequest({
      authenticatedSubject: subject,
      envelope: {
        ...envelope(),
        clientKey: "a8df4e21-8049-4f84-9ec3-0ad22f2ca174",
      },
    });
    expect(otherSubject?.requestId).not.toBe(original.requestId);
    expect(otherSubject?.actorDigest).not.toBe(original.actorDigest);
    expect(otherKey?.requestId).not.toBe(original.requestId);
    expect(otherKey?.actorDigest).toBe(original.actorDigest);
  });

  it.each([
    null,
    undefined,
    [],
    "request",
    {},
    { ...envelope(), schema: 2 },
    { ...envelope(), repositoryId: 1 },
    { ...envelope(), workNumber: 0 },
    { ...envelope(), workNumber: Number.NaN },
    { ...envelope(), workNumber: 1.5 },
    { ...envelope(), clientKey: "not-a-client-key" },
    { ...envelope(), authenticatedSubject: "human:owner" },
    { ...envelope(), humanApproval: true },
    { ...envelope(), role: "maintainer" },
    envelope({ kind: "raw-http", url: "https://github.com", ...metadata }),
    envelope({ ...commands[2], payload: "private body" }),
    envelope({ ...commands[2], beforeStateDigest: "missing" }),
    envelope({ ...commands[2], payloadDigest: 1 }),
    envelope({ ...commands[1], pullNumber: -1 }),
    envelope({ ...commands[1], baseSha: "invalid" }),
    envelope({ ...commands[3], taskNumber: 0 }),
    envelope({ ...commands[4], humanApproval: true }),
    envelope({ ...commands[5], projectNumber: 4 }),
    envelope({ ...commands[5], itemId: "" }),
    envelope({ ...commands[5], fieldId: "private\nfield" }),
  ])(
    "rejects unbound, malformed, content-bearing or authority-claiming metadata",
    (value) => {
      expect(
        prepareAuthoringRequest({
          authenticatedSubject: subject,
          envelope: value,
        }),
      ).toBeNull();
    },
  );

  it.each(["", " ", "x".repeat(201), "agent\nfixture"])(
    "rejects an invalid authenticated subject",
    (authenticatedSubject) => {
      expect(
        prepareAuthoringRequest({ authenticatedSubject, envelope: envelope() }),
      ).toBeNull();
    },
  );

  it.each([
    "refs/heads/main",
    "refs/heads/development",
    "refs/tags/v1",
    "refs/heads/",
    "refs/heads/a..b",
    "refs/heads/a@{b",
    "refs/heads/a.lock",
    "refs/heads/.hidden",
    "refs/heads/a//b",
    "refs/heads/a.",
    "refs/heads/a b",
    "refs/heads/a\nb",
    "refs/heads/a~b",
    "refs/heads/a^b",
    "refs/heads/a:b",
    "refs/heads/a?b",
    "refs/heads/a[b",
    "refs/heads/a\\b",
  ])("rejects an unsafe publication ref %s", (sourceRef) => {
    expect(
      prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: envelope({ ...commands[0], sourceRef }),
      }),
    ).toBeNull();
  });

  it("requires exact different Git heads", () => {
    for (const change of [
      { expectedHeadSha: "bad" },
      { proposedHeadSha: commands[0].expectedHeadSha },
    ]) {
      expect(
        prepareAuthoringRequest({
          authenticatedSubject: subject,
          envelope: envelope({ ...commands[0], ...change }),
        }),
      ).toBeNull();
    }
  });

  it("represents branch absence and creation verbs without manufacturing object IDs", () => {
    expect(
      prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: envelope({ ...commands[0], expectedHeadSha: null }),
      }),
    ).not.toBeNull();
    expect(
      prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: envelope({
          kind: "create-pull-request",
          sourceRef: "refs/heads/codex/work-140",
          headSha: "c".repeat(40),
          baseSha: "d".repeat(40),
          ...metadata,
        }),
      }),
    ).not.toBeNull();
    expect(
      prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: envelope({
          kind: "create-task",
          parentIssueId: 123,
          ...metadata,
        }),
      }),
    ).not.toBeNull();
    expect(
      prepareAuthoringRequest({
        authenticatedSubject: subject,
        envelope: envelope({
          kind: "create-task",
          parentIssueId: "caller-selected-parent",
          ...metadata,
        }),
      }),
    ).toBeNull();
  });
});

describe("minimized public authoring intent", () => {
  it("canonicalizes complete scope independently of graph enumeration order", () => {
    const request = prepare(commands[1]);
    const firstScope = { ...scope(request), affectedPulls: [148, 147] };
    const reversed = {
      ...firstScope,
      affectedWorks: [...firstScope.affectedWorks].reverse(),
      affectedPulls: [...firstScope.affectedPulls].reverse(),
      affectedRefs: [...firstScope.affectedRefs].reverse(),
    };
    const first = projectAuthoringIntent({
      request,
      scope: firstScope,
      authorityDigest: "e".repeat(64),
    });
    const second = projectAuthoringIntent({
      request,
      scope: reversed,
      authorityDigest: "e".repeat(64),
    });
    expect(first).toEqual(second);
    expect(first?.scope.affectedPulls).toEqual([147, 148]);
  });
  it.each(commands)(
    "projects $kind without raw subject, payload or command bytes",
    (command) => {
      const request = prepare(command);
      const intent = projectAuthoringIntent({
        request,
        scope: scope(request),
        authorityDigest: "e".repeat(64),
      });
      expect(intent).not.toBeNull();
      if (!intent) {
        throw new Error("Expected public fixture intent");
      }
      expect(Object.keys(intent).sort((a, b) => a.localeCompare(b))).toEqual([
        "actorDigest",
        "authorityDigest",
        "beforeStateDigest",
        "commandDigest",
        "requestId",
        "schema",
        "scope",
      ]);
      expect(JSON.stringify(intent)).not.toContain(subject);
      expect(JSON.stringify(intent)).not.toContain(envelope().clientKey);
      expect(intent).not.toHaveProperty("command");
      expect(intent).not.toHaveProperty("payloadDigest");
      expect(intent?.beforeStateDigest).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it.each([
    null,
    {},
    { ...scope(), repositoryId: 1 },
    { ...scope(), kind: "edit-work" },
    { ...scope(), affectedWorks: [138] },
    { ...scope(), affectedWorks: [140, 140] },
    { ...scope(), affectedRefs: [] },
    { ...scope(), affectedRefs: ["refs/heads/a\nb"] },
    { ...scope(), privateProjection: "private value" },
  ])("refuses an invalid or unrelated owner-derived scope", (value) => {
    expect(
      projectAuthoringIntent({
        request: prepare(),
        scope: value,
        authorityDigest: "e".repeat(64),
      }),
    ).toBeNull();
  });

  it("requires the PR in the resolved scope and a valid authority digest", () => {
    const request = prepare(commands[1]);
    expect(
      projectAuthoringIntent({
        request,
        scope: { ...scope(request), affectedPulls: [] },
        authorityDigest: "e".repeat(64),
      }),
    ).toBeNull();
    expect(
      projectAuthoringIntent({
        request,
        scope: scope(request),
        authorityDigest: "unverified",
      }),
    ).toBeNull();
  });

  it("copies scope arrays and detects command modification after preparation", () => {
    const request = prepare();
    const resolved = scope(request);
    const intent = projectAuthoringIntent({
      request,
      scope: resolved,
      authorityDigest: "e".repeat(64),
    });
    resolved.affectedWorks.push(999);
    expect(intent?.scope.affectedWorks).not.toContain(999);
    const changed = {
      ...request,
      command: { ...request.command, payloadDigest: "f".repeat(64) },
    };
    expect(
      projectAuthoringIntent({
        request: changed,
        scope: resolved,
        authorityDigest: "e".repeat(64),
      }),
    ).toBeNull();
    expect(classifyAuthoringReplay(changed, null)).toBe("conflict");
  });
});

describe("authoring request replay classification", () => {
  it("distinguishes canonical absence, pending and both terminal outcomes", () => {
    const request = prepare();
    expect(classifyAuthoringReplay(request, null)).toBe("unseen");
    expect(classifyAuthoringReplay(request, receipt(request))).toBe("pending");
    expect(
      classifyAuthoringReplay(request, receipt(request, "confirmed")),
    ).toBe("settled");
    expect(
      classifyAuthoringReplay(request, receipt(request, "known-unstarted")),
    ).toBe("settled");
    expect(
      classifyAuthoringReplay(request, receipt(request, "not-applied")),
    ).toBe("settled");
  });

  it.each([
    undefined,
    [],
    {},
    { ...receipt(), schema: 2 },
    { ...receipt(), requestId: "f".repeat(64) },
    { ...receipt(), actorDigest: "f".repeat(64) },
    { ...receipt(), commandDigest: "f".repeat(64) },
    { ...receipt(), state: "expired" },
    { ...receipt(), payload: "private body" },
  ])(
    "fails closed on missing, conflicting, replaced or unknown receipt evidence",
    (value) => {
      expect(classifyAuthoringReplay(prepare(), value)).toBe("conflict");
    },
  );

  it("rejects inconsistent prepared identities even on an empty lookup", () => {
    for (const change of [
      { repositoryId: 1 },
      { requestId: "bad" },
      { actorDigest: "bad" },
      { workNumber: 0 },
    ]) {
      expect(
        classifyAuthoringReplay(
          { ...prepare(), ...change } as PreparedAuthoringRequest,
          null,
        ),
      ).toBe("conflict");
    }
  });
});
