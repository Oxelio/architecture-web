import { createHash } from "node:crypto";

import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import type {
  AuthoringOutcomeProof,
  ResolvedAuthoringOperation,
} from "./controlled-authoring-execution.js";
import type { FetchLike } from "./github-project-inventory.js";
import { workReferences } from "./work-reference.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const repositoryId = 1336937640;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = { title: z.string().min(1).max(256), body: z.string().max(64000) };
const taskPayload = z.strictObject(text);
const pullPayload = z.strictObject({ ...text, draft: z.boolean() });
const issue = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  updated_at: z.string().datetime(),
  repository_url: z.literal(repository),
  pull_request: z.unknown().optional(),
});
const pull = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  body: z.string().nullable(),
  title: z.string(),
  state: z.enum(["open", "closed"]),
  draft: z.boolean(),
  head: z.object({
    sha: z.string().regex(/^[a-f0-9]{40}$/u),
    ref: z.string(),
    repo: z.object({ id: z.number().int().positive() }).nullable(),
  }),
  base: z.object({
    sha: z.string().regex(/^[a-f0-9]{40}$/u),
    ref: z.string(),
    repo: z.object({ id: z.literal(repositoryId) }),
  }),
});

interface Connection {
  readonly readToken: string;
  readonly fetchImpl?: FetchLike;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2026-03-10",
  };
}

function get(connection: Connection, path: string) {
  return (connection.fetchImpl ?? fetch)(`${repository}${path}`, {
    headers: headers(connection.readToken),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}

async function list(connection: Connection, path: string) {
  const result: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await get(
      connection,
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    if (response.status !== 200) {
      throw new Error("AUTHORING_INVENTORY_UNVERIFIED");
    }
    const values: unknown = await response.json();
    if (!Array.isArray(values)) {
      throw new Error("AUTHORING_INVENTORY_UNVERIFIED");
    }
    result.push(...values);
    if (!response.headers.get("link")?.includes('rel="next"')) {
      return result;
    }
  }
  throw new Error("AUTHORING_INVENTORY_INCOMPLETE");
}

export function authoringCreationMarker(request: PreparedAuthoringRequest) {
  return `<!-- delivery-authoring:${request.requestId}:${request.commandDigest}:${request.actorDigest} -->`;
}

async function readWork(
  connection: Connection,
  request: PreparedAuthoringRequest,
) {
  const response = await get(connection, `/issues/${request.workNumber}`);
  if (response.status !== 200) {
    return null;
  }
  const parsed = issue.safeParse(await response.json());
  if (
    !parsed.success ||
    parsed.data.number !== request.workNumber ||
    parsed.data.state !== "open" ||
    parsed.data.pull_request !== undefined
  ) {
    return null;
  }
  const parent = await get(connection, `/issues/${request.workNumber}/parent`);
  return parent.status === 404 ? parsed.data : null;
}

async function readPullCreationContext(
  connection: Connection,
  request: PreparedAuthoringRequest,
  work: z.infer<typeof issue>,
) {
  if (request.command.kind !== "create-pull-request") {
    return null;
  }
  const command = request.command;
  const pulls = z
    .array(pull)
    .parse(await list(connection, "/pulls?state=open"));
  const relevant = pulls.filter(
    (value) =>
      value.head.repo?.id === repositoryId &&
      (workReferences(value.body).includes(request.workNumber) ||
        value.head.ref === command.sourceRef.slice(11)),
  );
  const readRef = async (ref: string) => {
    const response = await get(
      connection,
      `/git/ref/heads/${ref.split("/").map(encodeURIComponent).join("/")}`,
    );
    if (response.status !== 200) {
      return null;
    }
    const parsed = z
      .object({
        ref: z.literal(`refs/heads/${ref}`),
        object: z.object({
          type: z.literal("commit"),
          sha: z.string().regex(/^[a-f0-9]{40}$/u),
        }),
      })
      .safeParse(await response.json());
    return parsed.success ? parsed.data.object.sha : null;
  };
  const [head, base] = await Promise.all([
    readRef(command.sourceRef.slice(11)),
    readRef("main"),
  ]);
  if (head !== command.headSha || base !== command.baseSha) {
    return null;
  }
  return {
    beforeStateDigest: digest([
      "create-pull-request",
      work.id,
      work.updated_at,
      head,
      base,
      relevant
        .map((value) => [
          value.id,
          value.number,
          value.head.sha,
          value.base.sha,
          digest(value.body),
        ])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ]),
    existing: relevant,
  };
}

export async function readAuthoringCreationContext(
  input: Connection & { readonly request: PreparedAuthoringRequest },
) {
  const work = await readWork(input, input.request);
  if (!work) {
    return null;
  }
  if (input.request.command.kind === "create-pull-request") {
    return readPullCreationContext(input, input.request, work);
  }
  if (
    input.request.command.kind !== "create-task" ||
    input.request.command.parentIssueId !== work.id
  ) {
    return null;
  }
  const children = z
    .array(issue)
    .parse(await list(input, `/issues/${input.request.workNumber}/sub_issues`));
  return {
    beforeStateDigest: digest([
      "create-task",
      work.id,
      work.updated_at,
      children
        .map((value) => [value.id, value.number, digest(value.body)])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ]),
    existing: children,
  };
}

interface CreationInput extends Connection {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly authoringToken: string;
  readonly expectedBotId: number;
  readonly expectedAppId: number;
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  readonly readAuthority: () => Promise<string | null>;
}

function creationPayload(input: CreationInput) {
  const command = input.request.command;
  const value: unknown = JSON.parse(
    Buffer.from(input.payload).toString("utf8"),
  );
  const marker = authoringCreationMarker(input.request);
  if (command.kind === "create-task") {
    const parsed = taskPayload.safeParse(value);
    return parsed.success
      ? {
          path: "/issues",
          body: {
            ...parsed.data,
            body: `${parsed.data.body}\n\n${marker}`,
            parent_issue_id: command.parentIssueId,
          },
        }
      : null;
  }
  if (command.kind !== "create-pull-request") {
    return null;
  }
  const parsed = pullPayload.safeParse(value);
  if (
    !parsed.success ||
    workReferences(parsed.data.body).length !== 1 ||
    workReferences(parsed.data.body)[0] !== input.request.workNumber
  ) {
    return null;
  }
  return {
    path: "/pulls",
    body: {
      ...parsed.data,
      body: `${parsed.data.body}\n\n${marker}`,
      head: command.sourceRef.slice(11),
      base: "main",
      maintainer_can_modify: false,
    },
  };
}

async function verifyCreatedObject(
  input: CreationInput,
  number: number,
  expected: NonNullable<ReturnType<typeof creationPayload>>,
): Promise<AuthoringOutcomeProof | null> {
  const response = await get(input, `${expected.path}/${number}`);
  if (response.status !== 200) {
    return null;
  }
  const identity = z
    .object({
      id: z.number().int().positive(),
      number: z.literal(number),
      title: z.literal(expected.body.title),
      body: z.literal(expected.body.body),
      user: z.object({
        id: z.literal(input.expectedBotId),
        type: z.literal("Bot"),
      }),
      performed_via_github_app: z.object({
        id: z.literal(input.expectedAppId),
      }),
    })
    .safeParse(await response.json());
  if (!identity.success) {
    return null;
  }
  if (input.request.command.kind === "create-task") {
    const response = await get(input, `/issues/${number}/parent`);
    if (response.status !== 200) {
      return null;
    }
    const parent = issue.safeParse(await response.json());
    if (
      !parent.success ||
      parent.data.id !== input.request.command.parentIssueId ||
      parent.data.number !== input.request.workNumber
    ) {
      return null;
    }
  } else {
    const response = await get(input, `/pulls/${number}`);
    if (response.status !== 200) {
      return null;
    }
    const created = pull.safeParse(await response.json());
    if (
      !created.success ||
      input.request.command.kind !== "create-pull-request" ||
      created.data.head.repo?.id !== repositoryId ||
      created.data.head.ref !== input.request.command.sourceRef.slice(11) ||
      created.data.head.sha !== input.request.command.headSha ||
      created.data.base.sha !== input.request.command.baseSha ||
      created.data.base.ref !== "main" ||
      !("draft" in expected.body) ||
      created.data.draft !== expected.body.draft
    ) {
      return null;
    }
  }
  return {
    outcome: "confirmed",
    proofDigest: digest([
      "created-object",
      input.request.requestId,
      identity.data.id,
      number,
      digest(identity.data.body),
    ]),
  };
}

export async function resolveAuthoringCreationOperation(
  input: CreationInput,
): Promise<ResolvedAuthoringOperation | null> {
  if (
    !input.authoringToken ||
    !Number.isSafeInteger(input.expectedAppId) ||
    input.expectedAppId < 1 ||
    !Number.isSafeInteger(input.expectedBotId) ||
    input.expectedBotId < 1
  ) {
    return null;
  }
  const expected = creationPayload(input);
  const before = await readAuthoringCreationContext(input);
  if (
    !expected ||
    !before ||
    input.request.command.kind === "publish-commit" ||
    before.beforeStateDigest !== input.request.command.beforeStateDigest ||
    (before.existing.length !== 0 &&
      input.request.command.kind === "create-pull-request")
  ) {
    return null;
  }
  const isCurrent = async () =>
    (await readAuthoringCreationContext(input))?.beforeStateDigest ===
    before.beforeStateDigest;
  return {
    scope: input.scope,
    reserved: input.reserved,
    inventoryComplete: input.inventoryComplete,
    authorityDigest: input.authorityDigest,
    readAuthority: input.readAuthority,
    isCurrent,
    observeOutcome: () => observeAuthoringCreationOutcome(input),
    async perform(authorize) {
      if (!(await isCurrent()) || !(await authorize())) {
        return {
          outcome: "known-unstarted",
          proofDigest: digest([
            "creation-handoff-not-started",
            input.request.requestId,
            before.beforeStateDigest,
          ]),
        };
      }
      const response = await (input.fetchImpl ?? fetch)(
        `${repository}${expected.path}`,
        {
          method: "POST",
          headers: headers(input.authoringToken),
          body: JSON.stringify(expected.body),
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status !== 201) {
        return null;
      }
      const result = z
        .object({ number: z.number().int().positive() })
        .safeParse(await response.json());
      return result.success
        ? verifyCreatedObject(input, result.data.number, expected)
        : null;
    },
  };
}

// Never retry a POST because a create response was lost. A positive unique
// authenticated object with the exact marker/content/relationship may settle it;
// absence, duplicates, edits or an unverifiable issuer leave it quarantined.
export async function observeAuthoringCreationOutcome(
  input: CreationInput,
): Promise<AuthoringOutcomeProof | null> {
  const expected = creationPayload(input);
  if (!expected) {
    return null;
  }
  const path =
    input.request.command.kind === "create-task"
      ? `/issues/${input.request.workNumber}/sub_issues`
      : "/pulls?state=all";
  const objects = z
    .array(
      z.object({
        number: z.number().int().positive(),
        body: z.string().nullable(),
      }),
    )
    .parse(await list(input, path));
  const matching = objects.filter((value) =>
    value.body?.includes(authoringCreationMarker(input.request)),
  );
  return matching.length === 1 && matching[0]
    ? verifyCreatedObject(input, matching[0].number, expected)
    : null;
}
