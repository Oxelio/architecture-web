import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import {
  readAuthoringProjectFieldContext,
  resolveAuthoringProjectFieldOperation,
} from "./authoring-project-field-operation.js";

function fixture(name: "Work Type" | "Priority" = "Work Type") {
  const payload = Buffer.from(JSON.stringify({ optionId: "new" }));
  let selected: string | null = null;
  const fetchImpl = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        query: string;
        variables: { option?: string };
      };
      if (request.query.includes("mutation")) {
        selected = request.variables.option ?? null;
        const key = request.query.includes("ClearField")
          ? "clearProjectV2ItemFieldValue"
          : "updateProjectV2ItemFieldValue";
        return Response.json({
          data: { [key]: { projectV2Item: { id: "item" } } },
        });
      }
      const field = {
        __typename: "ProjectV2SingleSelectField",
        id: "field",
        name,
        dataType: "SINGLE_SELECT",
        options: [{ id: "new", name: "Proposed value" }],
      };
      return Response.json({
        data: {
          user: {
            databaseId: 83680141,
            projectV2: {
              id: "PVT_kwHOBPzbjc4Bgts6",
              closed: false,
              fields: {
                nodes: [field, { ...field, id: "status", name: "Status" }],
                pageInfo: { hasNextPage: false },
              },
            },
          },
          node: {
            __typename: "ProjectV2Item",
            id: "item",
            isArchived: false,
            updatedAt: "2026-11-18T08:00:00Z",
            project: { id: "PVT_kwHOBPzbjc4Bgts6" },
            content: {
              __typename: "Issue",
              number: 140,
              parent: null,
              repository: { databaseId: 1336937640 },
            },
            fieldValues: {
              nodes: selected
                ? [
                    {
                      __typename: "ProjectV2ItemFieldSingleSelectValue",
                      optionId: selected,
                      updatedAt: "2026-11-18T08:01:00Z",
                      field: { id: "field" },
                    },
                  ]
                : [],
              pageInfo: { hasNextPage: false },
            },
          },
        },
      });
    },
  );
  const prepare = (beforeStateDigest = "a".repeat(64), fieldId = "field") => {
    const request = prepareAuthoringRequest({
      authenticatedSubject: "fixture",
      envelope: {
        schema: 1,
        repositoryId: 1336937640,
        workNumber: 140,
        clientKey: "11111111-1111-4111-8111-111111111111",
        command: {
          kind: "record-project-field",
          projectNumber: 3,
          itemId: "item",
          fieldId,
          beforeStateDigest,
          payloadDigest: createHash("sha256").update(payload).digest("hex"),
        },
      },
    });
    if (!request) {
      throw new Error("Invalid fixture");
    }
    return request;
  };
  const authorityDigest = "b".repeat(64);
  return {
    payload,
    prepare,
    fetchImpl,
    common: {
      projectsReadToken: "synthetic-reader",
      projectsWriteToken: "synthetic-writer",
      statusFieldId: "status",
      fetchImpl,
      scope: {
        repositoryId: 1336937640,
        kind: "record-project-field" as const,
        affectedWorks: [140],
        affectedPulls: [],
        affectedRefs: [],
      },
      reserved: null,
      inventoryComplete: true,
      authorityDigest,
      readAuthority: async () => authorityDigest,
    },
  };
}

it("writes only the exact activated non-Status field through its isolated credential", async () => {
  const f = fixture();
  const initial = { ...f.common, request: f.prepare(), payload: f.payload };
  const before = await readAuthoringProjectFieldContext(initial);
  if (!before) {
    throw new Error("Missing fixture context");
  }
  const input = { ...initial, request: f.prepare(before.beforeStateDigest) };
  const operation = await resolveAuthoringProjectFieldOperation(input);
  expect(await operation?.perform(async () => false)).toMatchObject({
    outcome: "known-unstarted",
  });
  expect(await operation?.perform(async () => true)).toMatchObject({
    outcome: "confirmed",
  });
  expect(await operation?.isCurrent()).toBe(false);
  expect(
    await readAuthoringProjectFieldContext({
      ...initial,
      request: f.prepare("a".repeat(64), "status"),
    }),
  ).toBeNull();
  expect(
    await resolveAuthoringProjectFieldOperation({
      ...input,
      projectsWriteToken: input.projectsReadToken,
    }),
  ).toBeNull();
  const mutations = f.fetchImpl.mock.calls.filter(([, init]) =>
    (JSON.parse(String(init?.body)) as { query: string }).query.includes(
      "mutation",
    ),
  );
  expect(mutations).toHaveLength(1);
  expect(
    (mutations[0]?.[1]?.headers as Record<string, string>)["Authorization"],
  ).toBe("Bearer synthetic-writer");
});

it("requires separately authenticated human Priority authority instead of classification permission", async () => {
  const f = fixture("Priority");
  const initial = { ...f.common, request: f.prepare(), payload: f.payload };
  const before = await readAuthoringProjectFieldContext(initial);
  if (!before) {
    throw new Error("Missing fixture context");
  }
  const input = { ...initial, request: f.prepare(before.beforeStateDigest) };
  expect(await resolveAuthoringProjectFieldOperation(input)).toBeNull();
  const operation = await resolveAuthoringProjectFieldOperation({
    ...input,
    readPriorityAuthority: async () => f.common.authorityDigest,
  });
  expect(await operation?.perform(async () => true)).toMatchObject({
    outcome: "confirmed",
  });
});
