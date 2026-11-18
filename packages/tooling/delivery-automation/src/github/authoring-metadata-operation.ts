import { createHash } from "node:crypto";

import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import type { ResolvedAuthoringOperation } from "./controlled-authoring-execution.js";
import type { FetchLike } from "./github-project-inventory.js";

const repository = "https://api.github.com/repos/Oxelio/architecture-web";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const editSchema = z.strictObject({
  title: z.string().min(1).max(256).optional(),
  body: z.string().max(65536).optional(),
});
const snapshotSchema = z.object({
  id: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  updated_at: z.string().datetime(),
  repository_url: z.string().optional(),
  pull_request: z.unknown().optional(),
  draft: z.boolean().optional(),
  head: z
    .object({
      sha: z.string().regex(/^[a-f0-9]{40}$/u),
      repo: z.object({ id: z.literal(1336937640) }),
    })
    .optional(),
  base: z
    .object({
      sha: z.string().regex(/^[a-f0-9]{40}$/u),
      ref: z.literal("main"),
      repo: z.object({ id: z.literal(1336937640) }),
    })
    .optional(),
});

export interface AuthoringMetadataSnapshot {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: "open" | "closed";
  readonly updatedAt: string;
  readonly draft: boolean | null;
  readonly headSha: string | null;
  readonly baseSha: string | null;
}

export function authoringMetadataBeforeDigest(
  snapshot: AuthoringMetadataSnapshot,
) {
  return digest([
    "authoring-metadata",
    snapshot.id,
    snapshot.number,
    snapshot.title,
    snapshot.body,
    snapshot.state,
    snapshot.updatedAt,
    snapshot.draft,
    snapshot.headSha,
    snapshot.baseSha,
  ]);
}

function path(request: PreparedAuthoringRequest) {
  switch (request.command.kind) {
    case "edit-work":
      return `/issues/${request.workNumber}`;
    case "edit-pull-request":
      return `/pulls/${request.command.pullNumber}`;
    default:
      return null;
  }
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function readAuthoringMetadataSnapshot(input: {
  readonly request: PreparedAuthoringRequest;
  readonly readToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<AuthoringMetadataSnapshot | null> {
  const target = path(input.request);
  if (!target || !input.readToken) {
    return null;
  }
  const response = await (input.fetchImpl ?? fetch)(`${repository}${target}`, {
    headers: headers(input.readToken),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 200) {
    return null;
  }
  const parsed = snapshotSchema.safeParse(await response.json());
  if (!parsed.success) {
    return null;
  }
  const value = parsed.data;
  const command = input.request.command;
  if (
    command.kind === "edit-work" &&
    (value.number !== input.request.workNumber ||
      value.repository_url !== repository ||
      value.pull_request !== undefined)
  ) {
    return null;
  }
  if (
    command.kind === "edit-pull-request" &&
    (value.number !== command.pullNumber ||
      value.head?.sha !== command.headSha ||
      value.base?.sha !== command.baseSha ||
      value.draft === undefined)
  ) {
    return null;
  }
  return {
    id: value.id,
    number: value.number,
    title: value.title,
    body: value.body,
    state: value.state,
    updatedAt: value.updated_at,
    draft: value.draft ?? null,
    headSha: value.head?.sha ?? null,
    baseSha: value.base?.sha ?? null,
  };
}

// Fixed PATCH adapters only. No arbitrary path, raw HTTP, closure, merge or
// approval verb can be supplied in the sealed payload. Canonical Role/scope
// authorization is supplied by the protected controller, never this parser.
export async function resolveAuthoringMetadataOperation(input: {
  readonly request: PreparedAuthoringRequest;
  readonly payload: Uint8Array;
  readonly readToken: string;
  readonly authoringToken: string;
  readonly fetchImpl?: FetchLike;
  readonly scope: ControlledWriteScope;
  readonly reserved: ReservedWriteContext | null;
  readonly inventoryComplete: boolean;
  readonly authorityDigest: string;
  readonly readAuthority: () => Promise<string | null>;
}): Promise<ResolvedAuthoringOperation | null> {
  const { request } = input;
  const target = path(request);
  if (!target || !input.authoringToken) {
    return null;
  }
  const parsed = editSchema.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  if (!parsed.success) {
    return null;
  }
  const edit = parsed.data;
  const before = await readAuthoringMetadataSnapshot(input);
  if (
    !before ||
    request.command.kind === "publish-commit" ||
    authoringMetadataBeforeDigest(before) !== request.command.beforeStateDigest
  ) {
    return null;
  }
  if (
    (edit.title === undefined || edit.title === before.title) &&
    (edit.body === undefined || edit.body === before.body)
  ) {
    return null;
  }
  const isCurrent = async () => {
    const current = await readAuthoringMetadataSnapshot(input);
    return (
      current !== null &&
      authoringMetadataBeforeDigest(current) ===
        authoringMetadataBeforeDigest(before)
    );
  };
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
            "metadata-handoff-not-started",
            request.requestId,
            authoringMetadataBeforeDigest(before),
          ]),
        };
      }
      const response = await (input.fetchImpl ?? fetch)(
        `${repository}${target}`,
        {
          method: "PATCH",
          headers: headers(input.authoringToken),
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify(edit),
        },
      );
      if (response.status !== 200) {
        return null;
      }
      const observed = await readAuthoringMetadataSnapshot(input);
      if (
        !observed ||
        observed.id !== before.id ||
        (edit.title !== undefined && observed.title !== edit.title) ||
        (edit.body !== undefined && observed.body !== edit.body)
      ) {
        return null;
      }
      return {
        outcome: "confirmed",
        proofDigest: digest([
          "metadata-applied",
          request.requestId,
          authoringMetadataBeforeDigest(observed),
        ]),
      };
    },
  };
}
