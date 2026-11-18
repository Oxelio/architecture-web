import { createHash } from "node:crypto";

import {
  type ControlledWriteScope,
  isControlledBranchRef,
  isControlledWriteScope,
} from "./controlled-write.js";

const repositoryId = 1336937640;
const sha = /^[a-f0-9]{40}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const clientKeyPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

interface Metadata {
  readonly beforeStateDigest: string;
  readonly payloadDigest: string;
}

export type AuthoringCommand =
  | {
      readonly kind: "publish-commit";
      readonly sourceRef: string;
      readonly expectedHeadSha: string;
      readonly proposedHeadSha: string;
      readonly payloadDigest: string;
    }
  | (Metadata & {
      readonly kind: "edit-pull-request";
      readonly pullNumber: number;
      readonly headSha: string;
      readonly baseSha: string;
    })
  | (Metadata & { readonly kind: "edit-work" })
  | (Metadata & {
      readonly kind: "edit-task-dependency";
      readonly taskNumber: number;
    })
  | (Metadata & { readonly kind: "record-evidence" })
  | (Metadata & {
      readonly kind: "record-project-field";
      readonly projectNumber: 3;
      readonly itemId: string;
      readonly fieldId: string;
    });

export interface PreparedAuthoringRequest {
  readonly schema: 1;
  readonly repositoryId: 1336937640;
  readonly workNumber: number;
  readonly requestId: string;
  readonly actorDigest: string;
  readonly commandDigest: string;
  readonly command: AuthoringCommand;
}

export interface PublicAuthoringIntent {
  readonly schema: 1;
  readonly requestId: string;
  readonly actorDigest: string;
  readonly commandDigest: string;
  readonly authorityDigest: string;
  readonly beforeStateDigest: string;
  readonly scope: ControlledWriteScope;
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

function id(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function opaqueId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[A-Za-z0-9_+=:/.-]{1,200}$/u.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && digestPattern.test(value);
}

function isSha(value: unknown): value is string {
  return typeof value === "string" && sha.test(value);
}

function command(value: unknown): AuthoringCommand | null {
  const item = object(value);
  if (!item || !isDigest(item["payloadDigest"])) {
    return null;
  }
  const payloadDigest = item["payloadDigest"];
  if (item["kind"] === "publish-commit") {
    return publicationCommand(item, payloadDigest);
  }
  if (!isDigest(item["beforeStateDigest"])) {
    return null;
  }
  return metadataCommand(item, {
    beforeStateDigest: item["beforeStateDigest"],
    payloadDigest,
  });
}

function publicationCommand(
  item: Record<string, unknown>,
  payloadDigest: string,
): AuthoringCommand | null {
  if (
    !keys(item, [
      "kind",
      "sourceRef",
      "expectedHeadSha",
      "proposedHeadSha",
      "payloadDigest",
    ]) ||
    !isControlledBranchRef(item["sourceRef"]) ||
    item["sourceRef"] === "refs/heads/main" ||
    !isSha(item["expectedHeadSha"]) ||
    !isSha(item["proposedHeadSha"]) ||
    item["expectedHeadSha"] === item["proposedHeadSha"]
  ) {
    return null;
  }
  return {
    kind: "publish-commit",
    sourceRef: item["sourceRef"],
    expectedHeadSha: item["expectedHeadSha"],
    proposedHeadSha: item["proposedHeadSha"],
    payloadDigest,
  };
}

function metadataCommand(
  item: Record<string, unknown>,
  { beforeStateDigest, payloadDigest }: Metadata,
): AuthoringCommand | null {
  const common = ["kind", "beforeStateDigest", "payloadDigest"];
  switch (item["kind"]) {
    case "edit-pull-request":
      return keys(item, [...common, "pullNumber", "headSha", "baseSha"]) &&
        id(item["pullNumber"]) &&
        isSha(item["headSha"]) &&
        isSha(item["baseSha"])
        ? {
            kind: "edit-pull-request",
            pullNumber: item["pullNumber"],
            headSha: item["headSha"],
            baseSha: item["baseSha"],
            beforeStateDigest,
            payloadDigest,
          }
        : null;
    case "edit-work":
      return keys(item, common)
        ? { kind: "edit-work", beforeStateDigest, payloadDigest }
        : null;
    case "edit-task-dependency":
      return keys(item, [...common, "taskNumber"]) && id(item["taskNumber"])
        ? {
            kind: "edit-task-dependency",
            taskNumber: item["taskNumber"],
            beforeStateDigest,
            payloadDigest,
          }
        : null;
    case "record-evidence":
      return keys(item, common)
        ? { kind: "record-evidence", beforeStateDigest, payloadDigest }
        : null;
    case "record-project-field":
      return keys(item, [...common, "projectNumber", "itemId", "fieldId"]) &&
        item["projectNumber"] === 3 &&
        opaqueId(item["itemId"]) &&
        opaqueId(item["fieldId"])
        ? {
            kind: "record-project-field",
            projectNumber: 3,
            itemId: item["itemId"],
            fieldId: item["fieldId"],
            beforeStateDigest,
            payloadDigest,
          }
        : null;
    default:
      return null;
  }
}

// Pure preparation only. Subject comes from authenticated transport, never
// the submitted envelope. Syntax and identity establish no Role or admission.
export function prepareAuthoringRequest(input: {
  readonly authenticatedSubject: string;
  readonly envelope: unknown;
}): PreparedAuthoringRequest | null {
  const { authenticatedSubject } = input;
  const envelope = object(input.envelope);
  if (
    !opaqueId(authenticatedSubject) ||
    !envelope ||
    !keys(envelope, [
      "schema",
      "repositoryId",
      "workNumber",
      "clientKey",
      "command",
    ]) ||
    envelope["schema"] !== 1 ||
    envelope["repositoryId"] !== repositoryId ||
    !id(envelope["workNumber"]) ||
    typeof envelope["clientKey"] !== "string" ||
    !clientKeyPattern.test(envelope["clientKey"])
  ) {
    return null;
  }
  const parsed = command(envelope["command"]);
  if (!parsed) {
    return null;
  }
  const workNumber = envelope["workNumber"];
  return {
    schema: 1,
    repositoryId,
    workNumber,
    requestId: digest([
      1,
      repositoryId,
      authenticatedSubject,
      envelope["clientKey"],
    ]),
    actorDigest: digest([
      "authoring-actor",
      repositoryId,
      authenticatedSubject,
    ]),
    commandDigest: digest([1, repositoryId, workNumber, parsed]),
    command: parsed,
  };
}

function isPreparedRequest(value: PreparedAuthoringRequest) {
  const normalized = command(value?.command);
  return (
    value?.schema === 1 &&
    value.repositoryId === repositoryId &&
    id(value.workNumber) &&
    isDigest(value.requestId) &&
    isDigest(value.actorDigest) &&
    normalized !== null &&
    digest([1, repositoryId, value.workNumber, normalized]) ===
      value.commandDigest
  );
}

// The trusted owner resolver supplies scope and authority evidence. This
// projection checks consistency, not proof of authorization or complete scope.
export function projectAuthoringIntent(input: {
  readonly request: PreparedAuthoringRequest;
  readonly scope: unknown;
  readonly authorityDigest: string;
}): PublicAuthoringIntent | null {
  const { request, scope, authorityDigest } = input;
  if (
    !isPreparedRequest(request) ||
    !isDigest(authorityDigest) ||
    !isControlledWriteScope(scope) ||
    scope.kind !== request.command.kind ||
    !scope.affectedWorks.includes(request.workNumber) ||
    (request.command.kind === "publish-commit" &&
      !scope.affectedRefs.includes(request.command.sourceRef)) ||
    (request.command.kind === "edit-pull-request" &&
      !scope.affectedPulls.includes(request.command.pullNumber))
  ) {
    return null;
  }
  return {
    schema: 1,
    requestId: request.requestId,
    actorDigest: request.actorDigest,
    commandDigest: request.commandDigest,
    authorityDigest,
    beforeStateDigest:
      request.command.kind === "publish-commit"
        ? digest([
            "git-head",
            request.command.sourceRef,
            request.command.expectedHeadSha,
          ])
        : request.command.beforeStateDigest,
    scope: {
      repositoryId,
      kind: scope.kind,
      affectedWorks: [...scope.affectedWorks].sort((a, b) => a - b),
      affectedPulls: [...scope.affectedPulls].sort((a, b) => a - b),
      affectedRefs: [...scope.affectedRefs].sort((a, b) => a.localeCompare(b)),
    },
  };
}

export function isPublicAuthoringIntent(
  value: unknown,
): value is PublicAuthoringIntent {
  const item = object(value);
  return (
    item !== null &&
    keys(item, [
      "schema",
      "requestId",
      "actorDigest",
      "commandDigest",
      "authorityDigest",
      "beforeStateDigest",
      "scope",
    ]) &&
    item["schema"] === 1 &&
    [
      "requestId",
      "actorDigest",
      "commandDigest",
      "authorityDigest",
      "beforeStateDigest",
    ].every((key) => isDigest(item[key])) &&
    isControlledWriteScope(item["scope"])
  );
}

// A null receipt must mean verified canonical absence, not an empty cache.
// No outcome below authorizes a remote operation or reuses an admission.
export function classifyAuthoringReplay(
  request: PreparedAuthoringRequest,
  receipt: unknown,
): "unseen" | "pending" | "settled" | "conflict" {
  if (!isPreparedRequest(request)) {
    return "conflict";
  }
  if (receipt === null) {
    return "unseen";
  }
  const value = object(receipt);
  if (
    !value ||
    !keys(value, [
      "schema",
      "requestId",
      "actorDigest",
      "commandDigest",
      "state",
    ]) ||
    value["schema"] !== 1 ||
    value["requestId"] !== request.requestId ||
    value["actorDigest"] !== request.actorDigest ||
    value["commandDigest"] !== request.commandDigest
  ) {
    return "conflict";
  }
  switch (value["state"]) {
    case "pending":
      return "pending";
    case "confirmed":
    case "known-unstarted":
    case "not-applied":
      return "settled";
    default:
      return "conflict";
  }
}
