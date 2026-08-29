import { describe, expect, it } from "vitest";

import {
  taskClaimFields,
  type TaskClaimRecord,
} from "../control/task-claim.js";
import {
  type OperationalOwnerActivation,
  readProjectWorkItems,
  readTaskDispatchCandidate,
  readWorkPullCandidates,
  resolveWorkIntegrationPr,
} from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function projectItem(input: {
  number: number;
  state?: "OPEN" | "CLOSED";
  parent?: number | null;
  labels?: readonly string[];
  workState?: string;
  priority?: string;
  claim?: TaskClaimRecord;
}): object {
  const fieldValues: object[] = [];
  if (input.workState) {
    fieldValues.push({
      __typename: "ProjectV2ItemFieldSingleSelectValue",
      name: input.workState,
      field: { name: "Work State" },
    });
  }
  if (input.priority) {
    fieldValues.push({
      __typename: "ProjectV2ItemFieldSingleSelectValue",
      name: input.priority,
      field: { name: "Priority" },
    });
  }
  if (input.claim) {
    for (const [name, text] of Object.entries(taskClaimFields(input.claim))) {
      fieldValues.push({
        __typename: "ProjectV2ItemFieldTextValue",
        text,
        field: { name },
      });
    }
  }

  return {
    id: `PVTI_${input.number}`,
    isArchived: false,
    content: {
      __typename: "Issue",
      number: input.number,
      state: input.state ?? "OPEN",
      repository: { nameWithOwner: "Oxelio/Architecture-Web" },
      parent:
        input.parent === undefined || input.parent === null
          ? null
          : {
              number: input.parent,
              repository: { nameWithOwner: "Oxelio/Architecture-Web" },
            },
      labels: {
        nodes: (input.labels ?? []).map((name) => ({ name })),
        pageInfo: { hasNextPage: false },
      },
    },
    fieldValues: {
      nodes: fieldValues,
      pageInfo: { hasNextPage: false },
    },
  };
}

function projectResponse(items: readonly object[]): object {
  return {
    data: {
      node: {
        __typename: "ProjectV2",
        items: {
          nodes: items,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  };
}

const activeOwners: OperationalOwnerActivation = {
  workState: true,
  priority: true,
  routes: true,
  dependencies: true,
  taskParent: true,
  taskClaim: true,
  workIntegrationPr: true,
};

describe("readProjectWorkItems", () => {
  it("reads only top-level repository Issues and excludes Sub-issues from Work state", async () => {
    const fetchImpl: FetchLike = async () =>
      jsonResponse(
        projectResponse([
          projectItem({
            number: 9,
            workState: "Implementing",
            priority: "P2 — Normal",
            labels: ["agent:codex"],
          }),
          projectItem({
            number: 10,
            parent: 9,
            workState: "Ready",
            priority: "P0 — Critical",
          }),
        ]),
      );

    const items = await readProjectWorkItems({
      repository: "Oxelio/Architecture-Web",
      projectId: "PVT_1",
      projectsToken: "project-token",
      fetchImpl,
    });

    expect(items).toEqual([
      {
        projectItemId: "PVTI_9",
        issueNumber: 9,
        issueOpen: true,
        labels: ["agent:codex"],
        fields: {
          "Work State": "Implementing",
          Priority: "P2 — Normal",
        },
      },
    ]);
  });
});

describe("readWorkPullCandidates", () => {
  it("derives native dependency and Work WIP state before executor selection", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/graphql") {
        return jsonResponse(
          projectResponse([
            projectItem({
              number: 20,
              workState: "Ready",
              priority: "P1 — High",
              labels: ["agent:codex"],
            }),
            projectItem({
              number: 21,
              workState: "Implementing",
              priority: "P2 — Normal",
              labels: ["agent:human"],
            }),
          ]),
        );
      }
      if (url.includes("/issues/20/dependencies/blocked_by")) {
        return jsonResponse([]);
      }
      if (url.includes("/issues/21/dependencies/blocked_by")) {
        return jsonResponse([{ number: 99, state: "open", labels: [] }]);
      }
      throw new Error(`Unexpected URL ${url}`);
    };

    const candidates = await readWorkPullCandidates({
      repository: "Oxelio/Architecture-Web",
      projectId: "PVT_1",
      projectsToken: "project-token",
      repositoryToken: "repo-token",
      activation: activeOwners,
      fetchImpl,
    });

    expect(candidates).toEqual([
      {
        workNumber: 20,
        workOpen: true,
        workStateAvailable: true,
        workState: "Ready",
        dependencyState: "resolved",
        wipState: "blocked",
        route: { mappingActive: true, labels: ["agent:codex"] },
        priorityAvailable: true,
        priority: "P1 — High",
      },
      {
        workNumber: 21,
        workOpen: true,
        workStateAvailable: true,
        workState: "Implementing",
        dependencyState: "blocked",
        wipState: "available",
        route: { mappingActive: true, labels: ["agent:human"] },
        priorityAvailable: true,
        priority: "P2 — Normal",
      },
    ]);
  });
});

describe("resolveWorkIntegrationPr", () => {
  it("selects the unique open same-repository PR targeting an authorized integration branch", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("/issues/9/timeline")) {
        return jsonResponse([
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 13,
                state: "open",
                labels: [],
                pull_request: {},
              },
            },
          },
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 8,
                state: "closed",
                labels: [],
                pull_request: {},
              },
            },
          },
        ]);
      }
      if (url.endsWith("/pulls/13")) {
        return jsonResponse({
          number: 13,
          state: "open",
          base: { ref: "development" },
          head: {
            ref: "technical/agent-aware-delivery-activation",
            repo: { full_name: "Oxelio/Architecture-Web" },
          },
        });
      }
      if (url.endsWith("/pulls/8")) {
        return jsonResponse({
          number: 8,
          state: "closed",
          base: { ref: "development" },
          head: { ref: "old", repo: { full_name: "Oxelio/Architecture-Web" } },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    };

    await expect(
      resolveWorkIntegrationPr({
        repository: "Oxelio/Architecture-Web",
        workNumber: 9,
        repositoryToken: "repo-token",
        active: true,
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "selected",
      pullRequest: {
        number: 13,
        headRef: "technical/agent-aware-delivery-activation",
        baseRef: "development",
      },
    });
  });

  it("fails closed when more than one open integration PR is referenced", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url.includes("/timeline")) {
        return jsonResponse([
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 13,
                state: "open",
                labels: [],
                pull_request: {},
              },
            },
          },
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 14,
                state: "open",
                labels: [],
                pull_request: {},
              },
            },
          },
        ]);
      }
      const number = url.endsWith("/14") ? 14 : 13;
      return jsonResponse({
        number,
        state: "open",
        base: { ref: "development" },
        head: {
          ref: `technical/work-${number}`,
          repo: { full_name: "Oxelio/Architecture-Web" },
        },
      });
    };

    const resolution = await resolveWorkIntegrationPr({
      repository: "Oxelio/Architecture-Web",
      workNumber: 9,
      repositoryToken: "repo-token",
      active: true,
      fetchImpl,
    });

    expect(resolution.status).toBe("ambiguous");
  });
});

describe("readTaskDispatchCandidate", () => {
  it("combines parent, dependency, route, claim and Work Integration PR evidence", async () => {
    const fetchImpl: FetchLike = async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/graphql") {
        return jsonResponse(
          projectResponse([
            projectItem({
              number: 9,
              workState: "Implementing",
              priority: "P2 — Normal",
              claim: {
                taskNumber: 42,
                claimant: "agent:codex",
                generation: "generation-1",
                runId: "123456",
                acquiredAt: "2026-08-29T16:00:00Z",
              },
            }),
          ]),
        );
      }
      if (url.endsWith("/issues/42")) {
        return jsonResponse({
          number: 42,
          state: "open",
          labels: [{ name: "agent:codex" }],
        });
      }
      if (url.endsWith("/issues/42/parent")) {
        return jsonResponse({ number: 9, state: "open", labels: [] });
      }
      if (url.includes("/issues/42/dependencies/blocked_by")) {
        return jsonResponse([]);
      }
      if (url.includes("/issues/9/timeline")) {
        return jsonResponse([
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 13,
                state: "open",
                labels: [],
                pull_request: {},
              },
            },
          },
        ]);
      }
      if (url.endsWith("/pulls/13")) {
        return jsonResponse({
          number: 13,
          state: "open",
          base: { ref: "development" },
          head: {
            ref: "technical/agent-aware-delivery-activation",
            repo: { full_name: "Oxelio/Architecture-Web" },
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    };

    const candidate = await readTaskDispatchCandidate({
      repository: "Oxelio/Architecture-Web",
      projectId: "PVT_1",
      projectsToken: "project-token",
      repositoryToken: "repo-token",
      workNumber: 9,
      taskNumber: 42,
      activation: activeOwners,
      fetchImpl,
    });

    expect(candidate).toEqual({
      workNumber: 9,
      taskNumber: 42,
      workOpen: true,
      taskOpen: true,
      taskParentState: "verified",
      workStateAvailable: true,
      workState: "Implementing",
      dependencyState: "resolved",
      route: { mappingActive: true, labels: ["agent:codex"] },
      claimState: "active",
      targetRef: {
        ref: "technical/agent-aware-delivery-activation",
        source: "authorized-work-context",
        authorizedRefs: ["technical/agent-aware-delivery-activation"],
      },
    });
  });
});
