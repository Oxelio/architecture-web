import { createHash } from "node:crypto";

import { z } from "zod";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import type {
  ControlledWriteScope,
  ReservedWriteContext,
} from "../control/controlled-write.js";
import type { ResolvedAuthoringOperation } from "./controlled-authoring-execution.js";
import type { FetchLike } from "./github-project-inventory.js";

const projectId = "PVT_kwHOBPzbjc4Bgts6";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fields = ["Work Type", "Workflow Depth", "Priority"] as const;
const option = z.object({ id: z.string(), name: z.string() });
const definition = z.object({
  __typename: z.literal("ProjectV2SingleSelectField"),
  id: z.string(),
  name: z.string(),
  dataType: z.literal("SINGLE_SELECT"),
  options: z.array(option),
});
const fieldValue = z.object({
  __typename: z.literal("ProjectV2ItemFieldSingleSelectValue"),
  optionId: z.string(),
  updatedAt: z.string().datetime(),
  field: z.object({ id: z.string() }),
});
const payloadSchema = z.strictObject({
  optionId: z.string().min(1).max(100).nullable(),
});

const readQuery = `query ArchitectureWebAuthoringField($item: ID!) {
  user(login: "Oxelio") {
    databaseId
    projectV2(number: 3) {
      id closed
      fields(first: 100) {
        nodes { __typename ... on ProjectV2SingleSelectField { id name dataType options { id name } } }
        pageInfo { hasNextPage }
      }
    }
  }
  node(id: $item) {
    __typename
    ... on ProjectV2Item {
      id isArchived updatedAt project { id }
      content { __typename ... on Issue { number parent { id } repository { databaseId } } }
      fieldValues(first: 100) {
        nodes { __typename ... on ProjectV2ItemFieldSingleSelectValue { optionId updatedAt field { ... on ProjectV2SingleSelectField { id } } } }
        pageInfo { hasNextPage }
      }
    }
  }
}`;
const setQuery = `mutation ArchitectureWebAuthoringSetField($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option } }) { projectV2Item { id } }
}`;
const clearQuery = `mutation ArchitectureWebAuthoringClearField($project: ID!, $item: ID!, $field: ID!) {
  clearProjectV2ItemFieldValue(input: { projectId: $project, itemId: $item, fieldId: $field }) { projectV2Item { id } }
}`;

interface FieldConnection {
  readonly request: PreparedAuthoringRequest;
  readonly projectsReadToken: string;
  // Resolved from the activated mapping by protected composition. Never take
  // this binding from the agent's command or let this adapter write Status.
  readonly statusFieldId: string;
  readonly fetchImpl?: FetchLike;
}

async function graphql(
  input: FieldConnection,
  token: string,
  query: string,
  variables: object,
): Promise<unknown> {
  const response = await (input.fetchImpl ?? fetch)(
    "https://api.github.com/graphql",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status !== 200) {
    return null;
  }
  const parsed = z
    .object({
      data: z.unknown().optional(),
      errors: z.array(z.unknown()).optional(),
    })
    .safeParse(await response.json());
  return parsed.success && !parsed.data.errors?.length
    ? parsed.data.data
    : null;
}

const snapshotSchema = z.object({
  user: z.object({
    databaseId: z.literal(83680141),
    projectV2: z.object({
      id: z.literal(projectId),
      closed: z.literal(false),
      fields: z.object({
        nodes: z.array(z.object({ __typename: z.string() }).passthrough()),
        pageInfo: z.object({ hasNextPage: z.literal(false) }),
      }),
    }),
  }),
  node: z.object({
    __typename: z.literal("ProjectV2Item"),
    id: z.string(),
    isArchived: z.literal(false),
    updatedAt: z.string().datetime(),
    project: z.object({ id: z.literal(projectId) }),
    content: z.object({
      __typename: z.literal("Issue"),
      number: z.number().int().positive(),
      parent: z.null(),
      repository: z.object({ databaseId: z.literal(1336937640) }),
    }),
    fieldValues: z.object({
      nodes: z.array(z.object({ __typename: z.string() }).passthrough()),
      pageInfo: z.object({ hasNextPage: z.literal(false) }),
    }),
  }),
});

export async function readAuthoringProjectFieldContext(input: FieldConnection) {
  const { command } = input.request;
  if (
    command.kind !== "record-project-field" ||
    !input.projectsReadToken ||
    !input.statusFieldId ||
    command.fieldId === input.statusFieldId
  ) {
    return null;
  }
  const parsed = snapshotSchema.safeParse(
    await graphql(input, input.projectsReadToken, readQuery, {
      item: command.itemId,
    }),
  );
  if (!parsed.success) {
    return null;
  }
  const { user, node: item } = parsed.data;
  if (
    item.id !== command.itemId ||
    item.content.number !== input.request.workNumber
  ) {
    return null;
  }
  const definitions = user.projectV2.fields.nodes
    .filter((value) => value.__typename === "ProjectV2SingleSelectField")
    .map((value) => definition.parse(value));
  const status = definitions.filter((value) => value.name === "Status");
  const matching = definitions.filter((value) => value.id === command.fieldId);
  const field = matching.length === 1 ? matching[0] : null;
  if (
    !field ||
    status.length !== 1 ||
    status[0]?.id !== input.statusFieldId ||
    !fields.some((name) => name === field.name) ||
    definitions.filter((value) => value.name === field.name).length !== 1 ||
    new Set(field.options.map((value) => value.id)).size !==
      field.options.length
  ) {
    return null;
  }
  const values = item.fieldValues.nodes
    .filter(
      (value) => value.__typename === "ProjectV2ItemFieldSingleSelectValue",
    )
    .map((value) => fieldValue.parse(value))
    .filter((value) => value.field.id === field.id);
  if (values.length > 1) {
    return null;
  }
  const selected = values[0];
  if (
    selected &&
    !field.options.some((value) => value.id === selected.optionId)
  ) {
    return null;
  }
  const options = [...field.options].sort((a, b) => a.id.localeCompare(b.id));
  return {
    field: { id: field.id, name: field.name, options },
    optionId: selected?.optionId ?? null,
    beforeStateDigest: digest([
      "project-field",
      projectId,
      item.id,
      field.id,
      field.name,
      options,
      selected?.optionId ?? null,
      selected?.updatedAt ?? item.updatedAt,
    ]),
  };
}

// Supports only the actually activated editable non-Status field types. No
// field/schema creation, routing invention or arbitrary GraphQL is exposed.
export async function resolveAuthoringProjectFieldOperation(
  input: FieldConnection & {
    readonly payload: Uint8Array;
    readonly projectsWriteToken: string;
    readonly scope: ControlledWriteScope;
    readonly reserved: ReservedWriteContext | null;
    readonly inventoryComplete: boolean;
    readonly authorityDigest: string;
    readonly readAuthority: () => Promise<string | null>;
    // Priority's human-only owner is independent of classification authority.
    // Protected composition must authenticate the actual human decision record.
    readonly readPriorityAuthority?: () => Promise<string | null>;
  },
): Promise<ResolvedAuthoringOperation | null> {
  if (
    !input.projectsWriteToken ||
    input.projectsWriteToken === input.projectsReadToken ||
    input.request.command.kind !== "record-project-field"
  ) {
    return null;
  }
  const payload = payloadSchema.safeParse(
    JSON.parse(Buffer.from(input.payload).toString("utf8")) as unknown,
  );
  const before = await readAuthoringProjectFieldContext(input);
  if (
    !payload.success ||
    !before ||
    before.beforeStateDigest !== input.request.command.beforeStateDigest ||
    before.optionId === payload.data.optionId ||
    (payload.data.optionId !== null &&
      !before.field.options.some((value) => value.id === payload.data.optionId))
  ) {
    return null;
  }
  const priorityCurrent = async () =>
    before.field.name !== "Priority" ||
    (await input.readPriorityAuthority?.()) === input.authorityDigest;
  if (!(await priorityCurrent())) {
    return null;
  }
  const isCurrent = async () =>
    (await readAuthoringProjectFieldContext(input))?.beforeStateDigest ===
      before.beforeStateDigest && (await priorityCurrent());
  const command = input.request.command;
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
            "project-field-handoff-not-started",
            input.request.requestId,
            before.beforeStateDigest,
          ]),
        };
      }
      const optionId = payload.data.optionId;
      const variables = {
        project: projectId,
        item: command.itemId,
        field: command.fieldId,
        ...(optionId === null ? {} : { option: optionId }),
      };
      const result = await graphql(
        input,
        input.projectsWriteToken,
        optionId === null ? clearQuery : setQuery,
        variables,
      );
      const changed = z
        .object(
          optionId === null
            ? {
                clearProjectV2ItemFieldValue: z.object({
                  projectV2Item: z.object({ id: z.literal(command.itemId) }),
                }),
              }
            : {
                updateProjectV2ItemFieldValue: z.object({
                  projectV2Item: z.object({ id: z.literal(command.itemId) }),
                }),
              },
        )
        .safeParse(result);
      if (!changed.success) {
        return null;
      }
      const observed = await readAuthoringProjectFieldContext(input);
      if (
        !observed ||
        observed.field.id !== before.field.id ||
        observed.optionId !== optionId
      ) {
        return null;
      }
      return {
        outcome: "confirmed",
        proofDigest: digest([
          "project-field-applied",
          input.request.requestId,
          observed.beforeStateDigest,
        ]),
      };
    },
  };
}
