import { describe, expect, it } from "vitest";

import {
  type FetchLike,
  readGitHubInventory,
} from "./github-project-inventory.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fieldNode(input: {
  readonly id: string;
  readonly name: string;
  readonly dataType: string;
  readonly options?: readonly string[];
}): unknown {
  return {
    __typename: input.options ? "ProjectV2SingleSelectField" : "ProjectV2Field",
    id: input.id,
    name: input.name,
    dataType: input.dataType,
    ...(input.options
      ? { options: input.options.map((name) => ({ name })) }
      : {}),
  };
}

function projectNode(input?: {
  readonly repositoriesHasNextPage?: boolean;
  readonly fieldsHasNextPage?: boolean;
  readonly viewFieldsHasNextPage?: boolean;
}): unknown {
  return {
    id: "PVT_1",
    number: 1,
    title: "Architecture Web",
    url: "https://github.com/users/Oxelio/projects/1",
    closed: false,
    owner: { login: "Oxelio" },
    repositories: {
      nodes: [{ nameWithOwner: "Oxelio/Architecture-Web" }],
      pageInfo: { hasNextPage: input?.repositoriesHasNextPage ?? false },
    },
    fields: {
      nodes: [
        fieldNode({
          id: "field-state",
          name: "Work State",
          dataType: "SINGLE_SELECT",
          options: ["Idea", "Done"],
        }),
      ],
      pageInfo: { hasNextPage: input?.fieldsHasNextPage ?? false },
    },
    views: {
      nodes: [
        {
          id: "view-1",
          number: 1,
          name: "Workflow",
          layout: "BOARD_LAYOUT",
          filter: "work-state:Ready",
          fields: {
            nodes: [
              fieldNode({ id: "title", name: "Title", dataType: "TITLE" }),
              fieldNode({
                id: "field-state",
                name: "Work State",
                dataType: "SINGLE_SELECT",
                options: ["Idea", "Done"],
              }),
            ],
            pageInfo: { hasNextPage: input?.viewFieldsHasNextPage ?? false },
          },
          groupByFields: {
            nodes: [],
            pageInfo: { hasNextPage: false },
          },
          verticalGroupByFields: {
            nodes: [
              fieldNode({
                id: "field-state",
                name: "Work State",
                dataType: "SINGLE_SELECT",
                options: ["Idea", "Done"],
              }),
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      ],
      pageInfo: { hasNextPage: false },
    },
  };
}

function projectsPayload(node: unknown): unknown {
  return {
    data: {
      repository: {
        projectsV2: {
          nodes: [node],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  };
}

describe("readGitHubInventory", () => {
  it("reads linked Projects v2, view configuration and repository labels without mutating GitHub", async () => {
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "https://api.github.com/graphql") {
        expect(init?.method).toBe("POST");
        return jsonResponse(projectsPayload(projectNode()));
      }

      if (url.includes("/repos/Oxelio/Architecture-Web/labels")) {
        return jsonResponse([
          { name: "agent:codex" },
          { name: "char:security" },
        ]);
      }

      throw new Error(`Unexpected URL ${url}`);
    };

    const result = await readGitHubInventory({
      repository: "Oxelio/Architecture-Web",
      projectsToken: "project-token",
      repositoryToken: "repo-token",
      fetchImpl,
    });

    expect(result.labels).toEqual(["agent:codex", "char:security"]);
    expect(result.projects).toEqual([
      {
        id: "PVT_1",
        owner: "Oxelio",
        number: 1,
        title: "Architecture Web",
        url: "https://github.com/users/Oxelio/projects/1",
        closed: false,
        repositories: ["Oxelio/Architecture-Web"],
        fields: [
          {
            id: "field-state",
            name: "Work State",
            dataType: "SINGLE_SELECT",
            options: ["Idea", "Done"],
          },
        ],
        views: [
          {
            id: "view-1",
            number: 1,
            name: "Workflow",
            layout: "BOARD_LAYOUT",
            filter: "work-state:Ready",
            visibleFields: ["Title", "Work State"],
            groupByFields: [],
            verticalGroupByFields: ["Work State"],
          },
        ],
      },
    ]);
  });

  it("fails closed when the Projects API cannot be read", async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input) === "https://api.github.com/graphql") {
        return jsonResponse({ message: "Forbidden" }, 403);
      }
      return jsonResponse([]);
    };

    await expect(
      readGitHubInventory({
        repository: "Oxelio/Architecture-Web",
        projectsToken: "project-token",
        fetchImpl,
      }),
    ).rejects.toThrow("GitHub Projects query failed with HTTP 403");
  });

  it("refuses a truncated field inventory", async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input) === "https://api.github.com/graphql") {
        return jsonResponse(
          projectsPayload(projectNode({ fieldsHasNextPage: true })),
        );
      }
      return jsonResponse([]);
    };

    await expect(
      readGitHubInventory({
        repository: "Oxelio/Architecture-Web",
        projectsToken: "project-token",
        fetchImpl,
      }),
    ).rejects.toThrow("inventory is incomplete");
  });

  it("refuses truncated repository linkage instead of guessing project ownership", async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input) === "https://api.github.com/graphql") {
        return jsonResponse(
          projectsPayload(projectNode({ repositoriesHasNextPage: true })),
        );
      }
      return jsonResponse([]);
    };

    await expect(
      readGitHubInventory({
        repository: "Oxelio/Architecture-Web",
        projectsToken: "project-token",
        fetchImpl,
      }),
    ).rejects.toThrow("linked to more than 100 repositories");
  });

  it("refuses truncated view field configuration", async () => {
    const fetchImpl: FetchLike = async (input) => {
      if (String(input) === "https://api.github.com/graphql") {
        return jsonResponse(
          projectsPayload(projectNode({ viewFieldsHasNextPage: true })),
        );
      }
      return jsonResponse([]);
    };

    await expect(
      readGitHubInventory({
        repository: "Oxelio/Architecture-Web",
        projectsToken: "project-token",
        fetchImpl,
      }),
    ).rejects.toThrow("visible fields exceeds the inventory page limit");
  });
});
