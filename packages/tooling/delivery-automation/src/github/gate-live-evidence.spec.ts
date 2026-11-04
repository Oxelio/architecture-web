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
  it.each([
    { scenario: "ready PR", draft: false, baseRef: "main", outcome: true },
    { scenario: "Draft PR", draft: true, baseRef: "main", outcome: false },
    {
      scenario: "PR retargeted after discovery",
      draft: false,
      baseRef: "other",
      outcome: null,
    },
    {
      scenario: "PR without readiness information",
      draft: undefined,
      baseRef: "main",
      outcome: null,
    },
  ])("gate: $scenario", async ({ draft, baseRef, outcome }) => {
    let pullRequestReads = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "https://api.github.com/graphql") {
          expect(JSON.parse(String(init?.body)).variables).toEqual({
            owner: "Oxelio",
            name: "Architecture-Web",
            number: 9,
          });
          return json({
            data: {
              repository: {
                nameWithOwner: repository,
                issue: {
                  number: 9,
                  state: "OPEN",
                  parent: null,
                  projectItems: {
                    nodes: [
                      {
                        project: { id: "PVT_project", closed: false },
                        status: { name: "Validating" },
                      },
                    ],
                    pageInfo: { hasNextPage: false },
                  },
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
          pullRequestReads += 1;
          return json({
            number: 13,
            state: "open",
            draft,
            merged: false,
            mergeable: true,
            base: {
              ref: pullRequestReads < 3 ? "main" : baseRef,
              sha: "b".repeat(40),
            },
            head: {
              ref: "technical/agent-aware-delivery-activation",
              sha: headSha,
              repo: { full_name: repository },
            },
          });
        }
        throw new Error(`Unexpected URL ${url}`);
      },
    );

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
    ).resolves.toEqual(
      outcome === null
        ? {
            status: "blocked",
            reason: "PR_MERGEABILITY_UNAVAILABLE",
          }
        : {
            status: "ready",
            workState: "Validating",
            dependenciesResolved: true,
            pullRequestMergeable: outcome,
            baseSha: "b".repeat(40),
            target: {
              pullRequestNumber: 13,
              headRef: "technical/agent-aware-delivery-activation",
              headSha,
              baseRef: "main",
            },
          },
    );
    expect(pullRequestReads).toBe(3);
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
