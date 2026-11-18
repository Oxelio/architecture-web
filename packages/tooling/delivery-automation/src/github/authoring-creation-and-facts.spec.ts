import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import type { ControlledWriteKind } from "../control/controlled-write.js";
import {
  observeAuthoringCreationOutcome,
  readAuthoringCreationContext,
  resolveAuthoringCreationOperation,
} from "./authoring-creation-operation.js";
import {
  observeAuthoringEvidenceOutcome,
  readAuthoringFactsContext,
  resolveAuthoringFactsOperation,
} from "./authoring-facts-operation.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const work = {
  id: 14000,
  number: 140,
  body: "approved synthetic Work",
  state: "open",
  updated_at: "2026-11-18T08:00:00Z",
  repository_url: repository,
};
const identity = {
  user: { id: 99, type: "Bot" },
  performed_via_github_app: { id: 5781545 },
};
function request(
  kind: ControlledWriteKind,
  payload: Uint8Array,
  details: object = {},
  beforeStateDigest = "a".repeat(64),
  clientKey = "11111111-1111-4111-8111-111111111111",
) {
  const prepared = prepareAuthoringRequest({
    authenticatedSubject: "fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey,
      command: {
        kind,
        ...details,
        beforeStateDigest,
        payloadDigest: createHash("sha256").update(payload).digest("hex"),
      },
    },
  });
  if (!prepared) {
    throw new Error("Invalid fixture request");
  }
  return prepared;
}

function common(kind: ControlledWriteKind) {
  return {
    readToken: "synthetic-reader",
    authoringToken: "synthetic-writer",
    expectedBotId: 99,
    expectedAppId: 5781545,
    scope: {
      repositoryId: 1336937640,
      kind,
      affectedWorks: [140],
      affectedPulls: [],
      affectedRefs: ["refs/heads/codex/work-140"],
    },
    reserved: null,
    inventoryComplete: true,
    authorityDigest: "b".repeat(64),
    readAuthority: async () => "b".repeat(64),
  };
}

it("creates a native Task once and reconciles a lost response through its exact authenticated object", async () => {
  const payload = Buffer.from(
    JSON.stringify({
      title: "Synthetic Task",
      body: "Follow the canonical Task plan.",
    }),
  );
  let child: Record<string, unknown> | null = null;
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (init?.method === "POST" && path.endsWith("/issues")) {
        const body = JSON.parse(String(init.body)) as {
          title: string;
          body: string;
          parent_issue_id: number;
        };
        expect(body.parent_issue_id).toBe(work.id);
        child = {
          ...work,
          id: 20000,
          number: 201,
          title: body.title,
          body: body.body,
          ...identity,
        };
        throw new Error("synthetic lost create response");
      }
      if (path.endsWith("/issues/140/parent")) {
        return new Response(null, { status: 404 });
      }
      if (path.endsWith("/issues/140/sub_issues")) {
        return Response.json(child ? [child] : []);
      }
      if (path.endsWith("/issues/201/parent") || path.endsWith("/issues/140")) {
        return Response.json(work);
      }
      if (path.endsWith("/issues/201")) {
        return Response.json(child);
      }
      throw new Error(`Unexpected fixture path ${path}`);
    },
  );
  const initial = {
    ...common("create-task"),
    request: request("create-task", payload, { parentIssueId: work.id }),
    payload,
    fetchImpl,
  };
  const context = await readAuthoringCreationContext(initial);
  if (!context) {
    throw new Error("Missing fixture context");
  }
  const input = {
    ...initial,
    request: request(
      "create-task",
      payload,
      { parentIssueId: work.id },
      context.beforeStateDigest,
    ),
  };
  const operation = await resolveAuthoringCreationOperation(input);
  expect(operation).not.toBeNull();
  await expect(operation?.perform(async () => true)).rejects.toThrow(
    "synthetic lost create response",
  );
  expect(await observeAuthoringCreationOutcome(input)).toMatchObject({
    outcome: "confirmed",
  });
  expect(
    fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
  child = Object.assign({}, child, { user: { id: 100, type: "Bot" } });
  expect(await observeAuthoringCreationOutcome(input)).toBeNull();
});

it("creates an owning PR only at the exact source/base and never submits after a changed head", async () => {
  const payload = Buffer.from(
    JSON.stringify({
      title: "Synthetic PR",
      body: "Proposed implementation.\n\nRefs #140",
      draft: true,
    }),
  );
  const details = {
    sourceRef: "refs/heads/codex/work-140",
    headSha: "c".repeat(40),
    baseSha: "d".repeat(40),
  };
  let head = details.headSha;
  let created: Record<string, unknown> | null = null;
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          title: string;
          body: string;
          draft: boolean;
          head: string;
          base: string;
        };
        created = {
          id: 15000,
          number: 150,
          title: body.title,
          body: body.body,
          draft: body.draft,
          state: "open",
          ...identity,
          head: { sha: head, ref: body.head, repo: { id: 1336937640 } },
          base: {
            sha: details.baseSha,
            ref: body.base,
            repo: { id: 1336937640 },
          },
        };
        return Response.json(created, { status: 201 });
      }
      if (path.endsWith("/issues/140/parent")) {
        return new Response(null, { status: 404 });
      }
      if (path.endsWith("/issues/140")) {
        return Response.json(work);
      }
      if (path.endsWith("/pulls/150")) {
        return Response.json(created);
      }
      if (path.endsWith("/pulls")) {
        return Response.json(created ? [created] : []);
      }
      if (path.endsWith("/git/ref/heads/main")) {
        return Response.json({
          ref: "refs/heads/main",
          object: { type: "commit", sha: details.baseSha },
        });
      }
      if (path.endsWith("/git/ref/heads/codex/work-140")) {
        return Response.json({
          ref: details.sourceRef,
          object: { type: "commit", sha: head },
        });
      }
      throw new Error(`Unexpected fixture path ${path}`);
    },
  );
  const initial = {
    ...common("create-pull-request"),
    request: request("create-pull-request", payload, details),
    payload,
    fetchImpl,
  };
  const context = await readAuthoringCreationContext(initial);
  if (!context) {
    throw new Error("Missing fixture context");
  }
  const input = {
    ...initial,
    request: request(
      "create-pull-request",
      payload,
      details,
      context.beforeStateDigest,
    ),
  };
  const operation = await resolveAuthoringCreationOperation(input);
  head = "e".repeat(40);
  expect(await operation?.perform(async () => true)).toMatchObject({
    outcome: "known-unstarted",
  });
  expect(
    fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(0);
  head = details.headSha;
  expect(await operation?.perform(async () => true)).toMatchObject({
    outcome: "confirmed",
  });
  expect(await resolveAuthoringCreationOperation(input)).toBeNull();
});

it("adds and removes only the exact native dependency of a Task owned by the Work", async () => {
  const task = { ...work, id: 13800, number: 138 };
  const dependency = { ...work, id: 13900, number: 139 };
  let blocked = false;
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          issue_id: dependency.id,
        });
        blocked = true;
        return Response.json(dependency, { status: 201 });
      }
      if (init?.method === "DELETE") {
        expect(path).toMatch(/\/blocked_by\/13900$/u);
        blocked = false;
        return Response.json(dependency);
      }
      if (path.endsWith("/issues/138/parent")) {
        return Response.json(work);
      }
      if (path.endsWith("/issues/138/dependencies/blocked_by")) {
        return Response.json(blocked ? [dependency] : []);
      }
      if (path.endsWith("/issues/138")) {
        return Response.json(task);
      }
      if (path.endsWith("/issues/139")) {
        return Response.json(dependency);
      }
      throw new Error(`Unexpected fixture path ${path}`);
    },
  );
  for (const operation of ["add", "remove"] as const) {
    const payload = Buffer.from(
      JSON.stringify({ operation, dependencyNumber: 139 }),
    );
    const key =
      operation === "add"
        ? "11111111-1111-4111-8111-111111111111"
        : "22222222-2222-4222-8222-222222222222";
    const initial = {
      ...common("edit-task-dependency"),
      request: request(
        "edit-task-dependency",
        payload,
        { taskNumber: 138 },
        "a".repeat(64),
        key,
      ),
      payload,
      fetchImpl,
    };
    const context = await readAuthoringFactsContext(initial);
    if (!context) {
      throw new Error("Missing fixture context");
    }
    const resolved = await resolveAuthoringFactsOperation({
      ...initial,
      request: request(
        "edit-task-dependency",
        payload,
        { taskNumber: 138 },
        context.beforeStateDigest,
        key,
      ),
    });
    expect(await resolved?.perform(async () => true)).toMatchObject({
      outcome: "confirmed",
    });
    expect(blocked).toBe(operation === "add");
  }
});

it("records attributable evidence once and quarantines spoofed or ambiguous recovery results", async () => {
  const payload = Buffer.from(
    JSON.stringify({
      body: "Synthetic technical review evidence, not Human Approval.",
    }),
  );
  interface Comment {
    id: number;
    issue_url: string;
    body: string;
    created_at: string;
    updated_at: string;
    user: { id: number; type: string };
    performed_via_github_app: { id: number };
  }
  let comments: Comment[] = [];
  const fetchImpl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (init?.method === "POST") {
        comments = [
          {
            id: 500,
            issue_url: `${repository}/issues/140`,
            body: (JSON.parse(String(init.body)) as { body: string }).body,
            created_at: work.updated_at,
            updated_at: work.updated_at,
            ...identity,
          },
        ];
        throw new Error("synthetic lost comment response");
      }
      if (path.endsWith("/issues/140")) {
        return Response.json(work);
      }
      if (path.endsWith("/issues/140/comments")) {
        return Response.json(comments);
      }
      if (path.endsWith("/issues/comments/500")) {
        return Response.json(comments[0]);
      }
      throw new Error(`Unexpected fixture path ${path}`);
    },
  );
  const initial = {
    ...common("record-evidence"),
    request: request("record-evidence", payload),
    payload,
    fetchImpl,
  };
  const context = await readAuthoringFactsContext(initial);
  if (!context) {
    throw new Error("Missing fixture context");
  }
  const input = {
    ...initial,
    request: request("record-evidence", payload, {}, context.beforeStateDigest),
  };
  const operation = await resolveAuthoringFactsOperation(input);
  await expect(operation?.perform(async () => true)).rejects.toThrow(
    "synthetic lost comment response",
  );
  expect(await observeAuthoringEvidenceOutcome(input)).toMatchObject({
    outcome: "confirmed",
  });
  const original = comments[0];
  if (!original) {
    throw new Error("Missing fixture comment");
  }
  comments = [{ ...original, user: { id: 100, type: "Bot" } }];
  expect(await observeAuthoringEvidenceOutcome(input)).toBeNull();
  comments = [original, { ...original, id: 501 }];
  expect(await observeAuthoringEvidenceOutcome(input)).toBeNull();
  expect(
    fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
});
