import { afterEach, expect, it, vi } from "vitest";

import { architectureWebDeliveryExpectations } from "../inventory/delivery-expectations.js";

const originalExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function connection<T>(nodes: readonly T[]) {
  return { nodes, pageInfo: { hasNextPage: false, endCursor: null } };
}

it("observes the Ready Queue without an executor and only makes read requests", async () => {
  vi.stubEnv("GITHUB_REPOSITORY", "Oxelio/architecture-web");
  vi.stubEnv("ARCHITECTURE_WEB_PROJECTS_TOKEN", "project-reader");
  vi.stubEnv("GITHUB_TOKEN", "repository-reader");
  vi.stubEnv("ARCHITECTURE_WEB_ACTIVATION_MANIFEST", "");
  vi.stubEnv("COORDINATOR_MODE", "");
  vi.stubEnv("EXECUTOR_ROUTE", "");
  process.exitCode = undefined;

  const { fields, labels } = architectureWebDeliveryExpectations;
  const project = {
    id: "PVT_3",
    number: 3,
    title: "Architecture Web",
    url: "https://github.com/users/Oxelio/projects/3",
    owner: { login: "Oxelio" },
    closed: false,
    repositories: connection([{ nameWithOwner: "Oxelio/architecture-web" }]),
    fields: connection(
      fields.map(({ name, dataType, options }) => ({
        __typename: "ProjectV2SingleSelectField",
        id: name,
        name,
        dataType,
        options: options?.map((option) => ({ name: option })),
      })),
    ),
    views: connection([]),
  };
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/graphql")) {
      expect(options?.method).toBe("POST");
      const query = JSON.parse(String(options?.body)).query;
      if (String(query).includes("query ArchitectureWebDeliveryProjects")) {
        return Response.json({
          data: { repository: { projectsV2: connection([project]) } },
        });
      }
      expect(String(query)).toContain("query ArchitectureWebOperationalItems");
      return Response.json({
        data: {
          node: {
            __typename: "ProjectV2",
            items: connection([
              {
                id: "PVTI_202",
                content: {
                  __typename: "Issue",
                  number: 202,
                  state: "OPEN",
                  repository: { nameWithOwner: "Oxelio/architecture-web" },
                },
                fieldValues: connection(
                  Object.entries({
                    Status: "Ready",
                    Priority: "P2 — Normal",
                  }).map(([name, value]) => ({
                    __typename: "ProjectV2ItemFieldSingleSelectValue",
                    name: value,
                    field: { name },
                  })),
                ),
              },
            ]),
          },
        },
      });
    }

    expect(options?.method ?? "GET").toBe("GET");
    if (url.includes("/labels?")) {
      return Response.json(labels.map((name) => ({ name })));
    }
    expect(url).toContain("/issues/202/dependencies/blocked_by");
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetch);

  const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  await import("./coordinator-dry-run.js");

  expect(process.exitCode).toBeUndefined();
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toMatchObject({
    status: "observed",
    mutationRequested: false,
    plan: {
      mode: "ready-queue",
      selectedWorkNumber: 202,
      dispatchRequested: false,
    },
  });
  expect(fetch).toHaveBeenCalledTimes(4);
});
