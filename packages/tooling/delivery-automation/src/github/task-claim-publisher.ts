import {
  type ParsedTaskClaim,
  parseTaskClaim,
  sameTaskClaim,
  taskClaimFieldNames,
  type TaskClaimRecord,
} from "../control/task-claim.js";
import type { FetchLike } from "./github-project-inventory.js";

export interface TaskClaimFieldIds {
  readonly activeTask: string;
  readonly claimant: string;
  readonly generation: string;
  readonly run: string;
  readonly acquiredAt: string;
}

export interface TaskClaimTarget {
  readonly projectId: string;
  readonly projectItemId: string;
  readonly fieldIds: TaskClaimFieldIds;
}

export type AcquireTaskClaimResult =
  | { readonly status: "acquired"; readonly record: TaskClaimRecord }
  | {
      readonly status: "blocked";
      readonly reason: "CLAIM_ACTIVE" | "CLAIM_INCONSISTENT";
    };

export type ReleaseTaskClaimResult =
  | { readonly status: "released" }
  | { readonly status: "already-released" }
  | {
      readonly status: "blocked";
      readonly reason:
        | "CLAIM_INCONSISTENT"
        | "CLAIM_GENERATION_MISMATCH"
        | "CLAIM_TASK_MISMATCH";
    };

interface GraphQlResponse<T> {
  readonly data?: T;
  readonly errors?: readonly { readonly message: string }[];
}

interface ClaimNodeResponse {
  readonly node?: {
    readonly __typename: string;
    readonly activeTask?: { readonly text?: string | null } | null;
    readonly claimant?: { readonly text?: string | null } | null;
    readonly generation?: { readonly text?: string | null } | null;
    readonly run?: { readonly text?: string | null } | null;
    readonly acquiredAt?: { readonly text?: string | null } | null;
  } | null;
}

const readClaimQuery = `
  query ArchitectureWebTaskClaim($itemId: ID!) {
    node(id: $itemId) {
      __typename
      ... on ProjectV2Item {
        activeTask: fieldValueByName(name: "Active Task") {
          ... on ProjectV2ItemFieldTextValue { text }
        }
        claimant: fieldValueByName(name: "Execution Claimant") {
          ... on ProjectV2ItemFieldTextValue { text }
        }
        generation: fieldValueByName(name: "Execution Claim Generation") {
          ... on ProjectV2ItemFieldTextValue { text }
        }
        run: fieldValueByName(name: "Execution Claim Run") {
          ... on ProjectV2ItemFieldTextValue { text }
        }
        acquiredAt: fieldValueByName(name: "Execution Claim Acquired At") {
          ... on ProjectV2ItemFieldTextValue { text }
        }
      }
    }
  }
`;

const setTextMutation = `
  mutation ArchitectureWebSetTaskClaimField(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
    $text: String!
  ) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { text: $text }
      }
    ) {
      projectV2Item { id }
    }
  }
`;

const clearFieldMutation = `
  mutation ArchitectureWebClearTaskClaimField(
    $projectId: ID!
    $itemId: ID!
    $fieldId: ID!
  ) {
    clearProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
      }
    ) {
      projectV2Item { id }
    }
  }
`;

function graphQlHeaders(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function graphQl<T>(input: {
  readonly token: string;
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly fetchImpl: FetchLike;
}): Promise<T> {
  const response = await input.fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: graphQlHeaders(input.token),
    body: JSON.stringify({ query: input.query, variables: input.variables }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Projects mutation/query failed with HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as GraphQlResponse<T>;
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `GitHub Projects mutation/query failed: ${payload.errors.map((error) => error.message).join("; ")}`,
    );
  }
  if (!payload.data) {
    throw new Error("GitHub Projects mutation/query returned no data");
  }
  return payload.data;
}

function text(
  value: { readonly text?: string | null } | null | undefined,
): string | undefined {
  return typeof value?.text === "string" ? value.text : undefined;
}

function nonEmpty(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function positiveTaskNumber(value: string | undefined): number | null {
  const raw = nonEmpty(value);
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readPublishedTaskClaimFields(input: {
  readonly target: TaskClaimTarget;
  readonly projectsToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<Readonly<Record<string, string>>> {
  const data = await graphQl<ClaimNodeResponse>({
    token: input.projectsToken,
    query: readClaimQuery,
    variables: { itemId: input.target.projectItemId },
    fetchImpl: input.fetchImpl,
  });

  const node = data.node;
  if (!node || node.__typename !== "ProjectV2Item") {
    throw new Error(
      `Project item '${input.target.projectItemId}' is unavailable`,
    );
  }

  const activeTask = nonEmpty(text(node.activeTask));
  const claimant = nonEmpty(text(node.claimant));
  const generation = nonEmpty(text(node.generation));
  const run = nonEmpty(text(node.run));
  const acquiredAt = nonEmpty(text(node.acquiredAt));

  return {
    ...(activeTask ? { [taskClaimFieldNames.activeTask]: activeTask } : {}),
    ...(claimant ? { [taskClaimFieldNames.claimant]: claimant } : {}),
    ...(generation ? { [taskClaimFieldNames.generation]: generation } : {}),
    ...(run ? { [taskClaimFieldNames.run]: run } : {}),
    ...(acquiredAt ? { [taskClaimFieldNames.acquiredAt]: acquiredAt } : {}),
  };
}

export async function readPublishedTaskClaim(input: {
  readonly target: TaskClaimTarget;
  readonly projectsToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<ParsedTaskClaim> {
  const fetchImpl = input.fetchImpl ?? fetch;
  return parseTaskClaim(
    await readPublishedTaskClaimFields({
      target: input.target,
      projectsToken: input.projectsToken,
      fetchImpl,
    }),
  );
}

async function setTextField(input: {
  readonly target: TaskClaimTarget;
  readonly fieldId: string;
  readonly value: string;
  readonly projectsToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<void> {
  await graphQl({
    token: input.projectsToken,
    query: setTextMutation,
    variables: {
      projectId: input.target.projectId,
      itemId: input.target.projectItemId,
      fieldId: input.fieldId,
      text: input.value,
    },
    fetchImpl: input.fetchImpl,
  });
}

async function clearField(input: {
  readonly target: TaskClaimTarget;
  readonly fieldId: string;
  readonly projectsToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<void> {
  await graphQl({
    token: input.projectsToken,
    query: clearFieldMutation,
    variables: {
      projectId: input.target.projectId,
      itemId: input.target.projectItemId,
      fieldId: input.fieldId,
    },
    fetchImpl: input.fetchImpl,
  });
}

function assertRecordIsInternallyValid(record: TaskClaimRecord): void {
  const parsed = parseTaskClaim({
    [taskClaimFieldNames.activeTask]: String(record.taskNumber),
    [taskClaimFieldNames.claimant]: record.claimant,
    [taskClaimFieldNames.generation]: record.generation,
    ...(record.runId ? { [taskClaimFieldNames.run]: record.runId } : {}),
    [taskClaimFieldNames.acquiredAt]: record.acquiredAt,
  });
  if (parsed.state !== "active" || !sameTaskClaim(parsed.record, record)) {
    throw new Error("Requested Task claim is internally inconsistent");
  }
}

export async function acquireTaskClaim(input: {
  readonly target: TaskClaimTarget;
  readonly record: TaskClaimRecord;
  readonly projectsToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<AcquireTaskClaimResult> {
  assertRecordIsInternallyValid(input.record);
  const fetchImpl = input.fetchImpl ?? fetch;
  const current = await readPublishedTaskClaim({
    target: input.target,
    projectsToken: input.projectsToken,
    fetchImpl,
  });

  if (current.state === "active") {
    return { status: "blocked", reason: "CLAIM_ACTIVE" };
  }
  if (current.state === "inconsistent") {
    return { status: "blocked", reason: "CLAIM_INCONSISTENT" };
  }

  await setTextField({
    target: input.target,
    fieldId: input.target.fieldIds.claimant,
    value: input.record.claimant,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  await setTextField({
    target: input.target,
    fieldId: input.target.fieldIds.generation,
    value: input.record.generation,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  if (input.record.runId) {
    await setTextField({
      target: input.target,
      fieldId: input.target.fieldIds.run,
      value: input.record.runId,
      projectsToken: input.projectsToken,
      fetchImpl,
    });
  }
  await setTextField({
    target: input.target,
    fieldId: input.target.fieldIds.acquiredAt,
    value: input.record.acquiredAt,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  // Active Task is the final commit marker. Any interruption before this write
  // leaves partial metadata that parses as inconsistent and therefore blocks.
  await setTextField({
    target: input.target,
    fieldId: input.target.fieldIds.activeTask,
    value: String(input.record.taskNumber),
    projectsToken: input.projectsToken,
    fetchImpl,
  });

  const verified = await readPublishedTaskClaim({
    target: input.target,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  if (
    verified.state !== "active" ||
    !sameTaskClaim(verified.record, input.record)
  ) {
    throw new Error(
      "Task claim acquisition verification failed; claim remains fail-closed",
    );
  }

  return { status: "acquired", record: verified.record };
}

function validateReleaseGuard(
  fields: Readonly<Record<string, string>>,
  current: ParsedTaskClaim,
  expectedTaskNumber: number,
  expectedGeneration: string,
): ReleaseTaskClaimResult | null {
  if (current.state === "idle") {
    return { status: "already-released" };
  }

  if (current.state === "active") {
    if (current.record.taskNumber !== expectedTaskNumber) {
      return { status: "blocked", reason: "CLAIM_TASK_MISMATCH" };
    }
    if (current.record.generation !== expectedGeneration) {
      return { status: "blocked", reason: "CLAIM_GENERATION_MISMATCH" };
    }
    return null;
  }

  const generation = nonEmpty(fields[taskClaimFieldNames.generation]);
  if (!generation) {
    return { status: "blocked", reason: "CLAIM_INCONSISTENT" };
  }
  if (generation !== expectedGeneration) {
    return { status: "blocked", reason: "CLAIM_GENERATION_MISMATCH" };
  }

  const activeTaskValue = nonEmpty(fields[taskClaimFieldNames.activeTask]);
  if (activeTaskValue) {
    const activeTask = positiveTaskNumber(activeTaskValue);
    if (!activeTask) {
      return { status: "blocked", reason: "CLAIM_INCONSISTENT" };
    }
    if (activeTask !== expectedTaskNumber) {
      return { status: "blocked", reason: "CLAIM_TASK_MISMATCH" };
    }
  }

  return null;
}

async function clearIfPresent(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly fieldName: string;
  readonly target: TaskClaimTarget;
  readonly fieldId: string;
  readonly projectsToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<void> {
  if (!nonEmpty(input.fields[input.fieldName])) {
    return;
  }
  await clearField({
    target: input.target,
    fieldId: input.fieldId,
    projectsToken: input.projectsToken,
    fetchImpl: input.fetchImpl,
  });
}

export async function releaseTaskClaim(input: {
  readonly target: TaskClaimTarget;
  readonly expectedTaskNumber: number;
  readonly expectedGeneration: string;
  readonly projectsToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<ReleaseTaskClaimResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const fields = await readPublishedTaskClaimFields({
    target: input.target,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  const current = parseTaskClaim(fields);
  const guardResult = validateReleaseGuard(
    fields,
    current,
    input.expectedTaskNumber,
    input.expectedGeneration,
  );
  if (guardResult) {
    return guardResult;
  }

  // Generation is the final release guard. Keeping it until the last mutation
  // makes an interrupted release safely retryable with the same generation,
  // while a stale generation still cannot clear a newer claim.
  await clearIfPresent({
    fields,
    fieldName: taskClaimFieldNames.claimant,
    target: input.target,
    fieldId: input.target.fieldIds.claimant,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  await clearIfPresent({
    fields,
    fieldName: taskClaimFieldNames.run,
    target: input.target,
    fieldId: input.target.fieldIds.run,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  await clearIfPresent({
    fields,
    fieldName: taskClaimFieldNames.acquiredAt,
    target: input.target,
    fieldId: input.target.fieldIds.acquiredAt,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  await clearIfPresent({
    fields,
    fieldName: taskClaimFieldNames.activeTask,
    target: input.target,
    fieldId: input.target.fieldIds.activeTask,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  await clearIfPresent({
    fields,
    fieldName: taskClaimFieldNames.generation,
    target: input.target,
    fieldId: input.target.fieldIds.generation,
    projectsToken: input.projectsToken,
    fetchImpl,
  });

  const verified = await readPublishedTaskClaim({
    target: input.target,
    projectsToken: input.projectsToken,
    fetchImpl,
  });
  if (verified.state !== "idle") {
    throw new Error(
      "Task claim release verification failed; claim remains fail-closed",
    );
  }

  return { status: "released" };
}
