import { createHash } from "node:crypto";

import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import { authoringCreationMarker } from "./authoring-creation-operation.js";
import type {
  AuthoringOutcomeProof,
  ResolvedAuthoringOperation,
} from "./controlled-authoring-execution.js";
import type { FetchLike } from "./github-project-inventory.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const issue = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  state: z.enum(["open", "closed"]),
  updated_at: z.string().datetime(),
  repository_url: z.literal(repository),
  pull_request: z.unknown().optional(),
});
const comment = z.object({
  id: z.number().int().positive(),
  issue_url: z.string(),
  body: z.string(),
  user: z.object({ id: z.number().int().positive(), type: z.string() }),
  performed_via_github_app: z
    .object({ id: z.number().int().positive() })
    .nullable()
    .optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
const dependencyPayload = z.strictObject({
  operation: z.enum(["add", "remove"]),
  dependencyNumber: z.number().int().positive().safe(),
});
const evidencePayload = z.strictObject({ body: z.string().min(1).max(64000) });

interface FactsInput {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly readToken: string;
  readonly authoringToken: string;
  readonly expectedBotId: number;
  readonly expectedAppId: number;
  readonly fetchImpl?: FetchLike;
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  readonly readAuthority: () => Promise<string | null>;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2026-03-10",
  };
}

function get(input: FactsInput, path: string) {
  return (input.fetchImpl ?? fetch)(`${repository}${path}`, {
    headers: headers(input.readToken),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}

async function readIssue(input: FactsInput, number: number) {
  const response = await get(input, `/issues/${number}`);
  if (response.status !== 200) {
    return null;
  }
  const parsed = issue.safeParse(await response.json());
  return parsed.success &&
    parsed.data.number === number &&
    parsed.data.pull_request === undefined
    ? parsed.data
    : null;
}

async function list(input: FactsInput, path: string) {
  const values: unknown[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await get(input, `${path}?per_page=100&page=${page}`);
    if (response.status !== 200) {
      throw new Error("AUTHORING_FACTS_UNVERIFIED");
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error("AUTHORING_FACTS_UNVERIFIED");
    }
    values.push(...body);
    if (!response.headers.get("link")?.includes('rel="next"')) {
      return values;
    }
  }
  throw new Error("AUTHORING_FACTS_INCOMPLETE");
}

async function readDependencyContext(
  input: FactsInput,
  payload: z.infer<typeof dependencyPayload>,
) {
  if (
    input.request.command.kind !== "edit-task-dependency" ||
    input.request.command.taskNumber === payload.dependencyNumber
  ) {
    return null;
  }
  const taskNumber = input.request.command.taskNumber;
  const [task, dependency, parentResponse] = await Promise.all([
    readIssue(input, taskNumber),
    readIssue(input, payload.dependencyNumber),
    get(input, `/issues/${taskNumber}/parent`),
  ]);
  if (
    !task ||
    !dependency ||
    task.state !== "open" ||
    parentResponse.status !== 200
  ) {
    return null;
  }
  const parent = issue.safeParse(await parentResponse.json());
  if (
    !parent.success ||
    parent.data.number !== input.request.workNumber ||
    parent.data.state !== "open"
  ) {
    return null;
  }
  const blockers = z
    .array(issue)
    .parse(await list(input, `/issues/${taskNumber}/dependencies/blocked_by`));
  const ids = blockers.map((value) => value.id);
  if (new Set(ids).size !== ids.length) {
    return null;
  }
  return {
    task,
    dependency,
    present: ids.includes(dependency.id),
    beforeStateDigest: digest([
      "task-dependency",
      task.id,
      task.updated_at,
      parent.data.id,
      dependency.id,
      blockers
        .map((value) => [value.id, value.number, value.state])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ]),
  };
}

async function resolveDependency(
  input: FactsInput,
): Promise<ResolvedAuthoringOperation | null> {
  const parsed = dependencyPayload.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  if (
    !parsed.success ||
    input.request.command.kind !== "edit-task-dependency"
  ) {
    return null;
  }
  const payload = parsed.data;
  const before = await readDependencyContext(input, payload);
  if (
    !before ||
    before.beforeStateDigest !== input.request.command.beforeStateDigest ||
    before.present === (payload.operation === "add")
  ) {
    return null;
  }
  const isCurrent = async () =>
    (await readDependencyContext(input, payload))?.beforeStateDigest ===
    before.beforeStateDigest;
  return {
    scope: input.scope,
    reserved: input.reserved,
    inventoryComplete: input.inventoryComplete,
    authorityDigest: input.authorityDigest,
    readAuthority: input.readAuthority,
    isCurrent,
    async perform(authorize) {
      if (!(await isCurrent()) || !(await authorize())) {
        return {
          outcome: "known-unstarted",
          proofDigest: digest([
            "dependency-handoff-not-started",
            input.request.requestId,
            before.beforeStateDigest,
          ]),
        };
      }
      const adding = payload.operation === "add";
      const path = `/issues/${before.task.number}/dependencies/blocked_by${adding ? "" : `/${before.dependency.id}`}`;
      const response = await (input.fetchImpl ?? fetch)(
        `${repository}${path}`,
        {
          method: adding ? "POST" : "DELETE",
          headers: headers(input.authoringToken),
          ...(adding
            ? { body: JSON.stringify({ issue_id: before.dependency.id }) }
            : {}),
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status !== (adding ? 201 : 200)) {
        return null;
      }
      const observed = await readDependencyContext(input, payload);
      if (
        !observed ||
        observed.task.id !== before.task.id ||
        observed.dependency.id !== before.dependency.id ||
        observed.present !== adding
      ) {
        return null;
      }
      return {
        outcome: "confirmed",
        proofDigest: digest([
          "dependency-applied",
          input.request.requestId,
          observed.beforeStateDigest,
        ]),
      };
    },
  };
}

async function readEvidenceContext(input: FactsInput) {
  const work = await readIssue(input, input.request.workNumber);
  if (!work || work.state !== "open") {
    return null;
  }
  const comments = z
    .array(comment)
    .parse(await list(input, `/issues/${input.request.workNumber}/comments`));
  if (
    comments.some(
      (value) =>
        value.issue_url !== `${repository}/issues/${input.request.workNumber}`,
    ) ||
    new Set(comments.map((value) => value.id)).size !== comments.length
  ) {
    return null;
  }
  return {
    comments,
    beforeStateDigest: digest([
      "work-evidence",
      work.id,
      work.updated_at,
      comments
        .map((value) => [
          value.id,
          value.user.id,
          value.performed_via_github_app?.id ?? null,
          value.updated_at,
          digest(value.body),
        ])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ]),
  };
}

async function verifyEvidence(
  input: FactsInput,
  id: number,
  body: string,
): Promise<AuthoringOutcomeProof | null> {
  const response = await get(input, `/issues/comments/${id}`);
  if (response.status !== 200) {
    return null;
  }
  const parsed = comment.safeParse(await response.json());
  if (!parsed.success) {
    return null;
  }
  const value = parsed.data;
  if (
    value.id !== id ||
    value.issue_url !== `${repository}/issues/${input.request.workNumber}` ||
    value.user.id !== input.expectedBotId ||
    value.user.type !== "Bot" ||
    value.performed_via_github_app?.id !== input.expectedAppId ||
    value.body !== body ||
    value.created_at !== value.updated_at
  ) {
    return null;
  }
  return {
    outcome: "confirmed",
    proofDigest: digest([
      "evidence-recorded",
      input.request.requestId,
      id,
      value.user.id,
      input.expectedAppId,
      digest(body),
    ]),
  };
}

async function resolveEvidence(
  input: FactsInput,
): Promise<ResolvedAuthoringOperation | null> {
  const parsed = evidencePayload.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  if (!parsed.success || input.request.command.kind !== "record-evidence") {
    return null;
  }
  const before = await readEvidenceContext(input);
  if (
    !before ||
    before.beforeStateDigest !== input.request.command.beforeStateDigest ||
    before.comments.some((value) =>
      value.body.includes(authoringCreationMarker(input.request)),
    )
  ) {
    return null;
  }
  const body = `${parsed.data.body}\n\n${authoringCreationMarker(input.request)}`;
  const isCurrent = async () =>
    (await readEvidenceContext(input))?.beforeStateDigest ===
    before.beforeStateDigest;
  return {
    scope: input.scope,
    reserved: input.reserved,
    inventoryComplete: input.inventoryComplete,
    authorityDigest: input.authorityDigest,
    readAuthority: input.readAuthority,
    isCurrent,
    async perform(authorize) {
      if (!(await isCurrent()) || !(await authorize())) {
        return {
          outcome: "known-unstarted",
          proofDigest: digest([
            "evidence-handoff-not-started",
            input.request.requestId,
            before.beforeStateDigest,
          ]),
        };
      }
      const response = await (input.fetchImpl ?? fetch)(
        `${repository}/issues/${input.request.workNumber}/comments`,
        {
          method: "POST",
          headers: headers(input.authoringToken),
          body: JSON.stringify({ body }),
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (response.status !== 201) {
        return null;
      }
      const created = z
        .object({ id: z.number().int().positive() })
        .safeParse(await response.json());
      return created.success
        ? verifyEvidence(input, created.data.id, body)
        : null;
    },
  };
}

export async function readAuthoringFactsContext(input: FactsInput) {
  if (input.request.command.kind === "record-evidence") {
    return readEvidenceContext(input);
  }
  const parsed = dependencyPayload.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  return parsed.success ? readDependencyContext(input, parsed.data) : null;
}

export async function resolveAuthoringFactsOperation(input: FactsInput) {
  if (
    !input.authoringToken ||
    !Number.isSafeInteger(input.expectedBotId) ||
    input.expectedBotId < 1 ||
    !Number.isSafeInteger(input.expectedAppId) ||
    input.expectedAppId < 1
  ) {
    return null;
  }
  switch (input.request.command.kind) {
    case "edit-task-dependency":
      return resolveDependency(input);
    case "record-evidence":
      return resolveEvidence(input);
    default:
      return null;
  }
}

export async function observeAuthoringEvidenceOutcome(
  input: FactsInput,
): Promise<AuthoringOutcomeProof | null> {
  if (input.request.command.kind !== "record-evidence") {
    return null;
  }
  const parsed = evidencePayload.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  const context = parsed.success ? await readEvidenceContext(input) : null;
  if (!parsed.success || !context) {
    return null;
  }
  const matching = context.comments.filter((value) =>
    value.body.includes(authoringCreationMarker(input.request)),
  );
  const found = matching.length === 1 ? matching[0] : null;
  return found
    ? verifyEvidence(
        input,
        found.id,
        `${parsed.data.body}\n\n${authoringCreationMarker(input.request)}`,
      )
    : null;
}
