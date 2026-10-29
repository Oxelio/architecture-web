import { describe, expect, it, vi } from "vitest";

import { readWorkMergeGateLiveEvidence } from "./gate-live-evidence.js";

const repository = "Oxelio/Architecture-Web";
const repositoryUrl = `https://api.github.com/repos/${repository}`;
const headSha = "a".repeat(40);

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("readWorkMergeGateLiveEvidence", () => {
  it("combines live Project, dependency, Work Integration PR and mergeability state", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://api.github.com/graphql") {
        return json({
          data: {
            node: {
              __typename: "ProjectV2",
              items: {
                nodes: [
                  {
                    id: "PVTI_work",
                    isArchived: false,
                    content: {
                      __typename: "Issue",
                      number: 9,
                      state: "OPEN",
                      repository: { nameWithOwner: repository },
                      parent: null,
                      labels: {
                        nodes: [],
                        pageInfo: { hasNextPage: false },
                      },
                    },
                    fieldValues: {
                      nodes: [
                        {
                          __typename: "ProjectV2ItemFieldSingleSelectValue",
                          name: "Validating",
                          field: { name: "Status" },
                        },
                      ],
                      pageInfo: { hasNextPage: false },
                    },
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        });
      }
      if (url.includes("/issues/9/dependencies/blocked_by")) {
        return json([]);
      }
      if (url.includes("/issues/9/timeline")) {
        return json([
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 13,
                repository_url: repositoryUrl,
                pull_request: {},
              },
            },
          },
        ]);
      }
      if (url.endsWith("/pulls/13")) {
        return json({
          number: 13,
          state: "open",
          merged: false,
          mergeable: true,
          base: { ref: "main" },
          head: {
            ref: "technical/agent-aware-delivery-activation",
            sha: headSha,
            repo: { full_name: repository },
          },
        });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      readWorkMergeGateLiveEvidence({
        repository,
        projectId: "PVT_project",
        projectsToken: "projects-token",
        repositoryToken: "repo-token",
        workNumber: 9,
        activation: {
          workState: true,
          priority: false,
          routes: false,
          dependencies: true,
          taskParent: false,
          taskClaim: false,
          workIntegrationPr: true,
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "ready",
      workState: "Validating",
      dependenciesResolved: true,
      pullRequestMergeable: true,
      target: {
        pullRequestNumber: 13,
        headRef: "technical/agent-aware-delivery-activation",
        headSha,
        baseRef: "main",
      },
    });
  });

  it("fails closed before GitHub reads when a required owner is inactive", async () => {
    const fetchImpl = vi.fn();

    await expect(
      readWorkMergeGateLiveEvidence({
        repository,
        projectId: "PVT_project",
        projectsToken: "projects-token",
        repositoryToken: "repo-token",
        workNumber: 9,
        activation: {
          workState: false,
          priority: false,
          routes: false,
          dependencies: true,
          taskParent: false,
          taskClaim: false,
          workIntegrationPr: true,
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "WORK_STATE_OWNER_INACTIVE",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
