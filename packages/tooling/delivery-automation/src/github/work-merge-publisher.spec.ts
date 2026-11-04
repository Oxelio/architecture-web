import { describe, expect, it, vi } from "vitest";

import {
  observeWorkMerge,
  publishWorkMerge,
  type WorkMergeGrant,
  type WorkMergePublisher,
} from "./work-merge-publisher.js";

const candidate = {
  workNumber: 91,
  pullNumber: 92,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const mergeSha = "c".repeat(40);
const testSha = "d".repeat(40);
const repository = "Oxelio/architecture-web";
const repoUrl = `https://api.github.com/repos/${repository}`;
const gate = "Architecture Web / Work Merge Gate";
const checks = [
  { name: "Quality checks", id: 15368 },
  { name: "SonarCloud Code Analysis", id: 12526 },
  { name: gate, id: 7 },
];

function fixture() {
  const state = {
    actorId: 12,
    boundary: true,
    workState: "Validating",
    dependencyOpen: false,
    missingReview: false,
    missingApproval: false,
    revokedDecision: false,
    moving: "",
    check: "success",
    missingCheck: false,
    untrustedGate: false,
    staleGate: false,
    mergeTimeout: false,
    merged: false,
    armed: false,
    observation: false,
    closingIssues: 0,
    title: "feat: integrate ordinary Work",
  };
  const grant: WorkMergeGrant = {
    actorId: 12,
    repositoryId: 8,
    workNumber: 91,
    pullNumber: 92,
    requiredTasks: [],
    gateAppId: 7,
    rulesetId: 9,
    direct: true,
    auto: true,
    evidence: [
      { kind: "code-review", commentId: 1, authorId: 12 },
      { kind: "working-decisions", commentId: 2, authorId: 12 },
      { kind: "functional-approval", commentId: 3, authorId: 13 },
    ],
  };
  const writes: { url: string; method: string; body: unknown }[] = [];
  let prReads = 0;
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "null")) as unknown;
      if (
        url === "https://api.github.com/graphql" &&
        String(init?.body).includes("ArchitectureWebGateWorkItem")
      ) {
        return Response.json({
          data: {
            repository: {
              nameWithOwner: repository,
              issue: {
                number: 91,
                state: "OPEN",
                parent: null,
                projectItems: {
                  nodes: [
                    {
                      project: { id: "project", closed: false },
                      status: { name: state.workState },
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        });
      }
      if (url.endsWith("/pulls/92/merge")) {
        writes.push({ url, method: "PUT", body });
        state.merged = true;
        if (state.mergeTimeout) {
          throw new Error("lost response");
        }
        return Response.json({ merged: true, sha: mergeSha });
      }
      if (
        url === "https://api.github.com/graphql" &&
        String(init?.body).includes("enablePullRequestAutoMerge")
      ) {
        writes.push({ url, method: "POST", body });
        state.armed = true;
        return Response.json({
          data: {
            enablePullRequestAutoMerge: {
              pullRequest: {
                id: "pr-node",
                autoMergeRequest: { enabledAt: "now" },
              },
            },
          },
        });
      }
      if (
        url === "https://api.github.com/graphql" &&
        String(init?.body).includes("closingIssuesReferences")
      ) {
        return Response.json({
          data: {
            node: {
              id: "pr-node",
              closingIssuesReferences: { totalCount: state.closingIssues },
            },
          },
        });
      }
      if (url.endsWith("/pulls/92")) {
        const changed = ++prReads >= 5;
        return Response.json({
          number: 92,
          node_id: "pr-node",
          title: state.title,
          draft: false,
          state: state.merged ? "closed" : "open",
          mergeable: true,
          merged: state.merged,
          merge_commit_sha: state.merged ? mergeSha : testSha,
          auto_merge: state.armed ? {} : null,
          head: {
            ref: "codex/91",
            sha:
              changed && state.moving === "head" ? mergeSha : candidate.headSha,
            repo: { id: 8, full_name: repository },
          },
          base: {
            ref: changed && state.moving === "target" ? "other" : "main",
            sha: candidate.baseSha,
            repo: { id: 8 },
          },
        });
      }
      if (url.includes("/issues/91/timeline")) {
        return Response.json([
          {
            event: "cross-referenced",
            source: {
              issue: { number: 92, repository_url: repoUrl, pull_request: {} },
            },
          },
        ]);
      }
      if (url.includes("/dependencies/blocked_by")) {
        return Response.json(state.dependencyOpen ? [{ state: "open" }] : []);
      }
      if (url.includes("/sub_issues")) {
        return Response.json([]);
      }
      if (url.includes("/issues/comments/")) {
        const id = Number(url.split("/").at(-1));
        if (
          (id === 1 && state.missingReview) ||
          (id === 3 && state.missingApproval)
        ) {
          return new Response(null, { status: 404 });
        }
        const reference = grant.evidence.find((item) => item.commentId === id);
        return Response.json({
          id,
          issue_url: `${repoUrl}/issues/91`,
          user: { id: reference?.authorId, type: "User" },
          performed_via_github_app: null,
          body: JSON.stringify({
            ...candidate,
            kind: reference?.kind,
            decision:
              id === 2 && state.revokedDecision ? "revoked" : "accepted",
          }),
        });
      }
      if (url.endsWith("/rulesets/9")) {
        return Response.json({
          id: 9,
          target: "branch",
          enforcement: "active",
          bypass_actors: [],
          conditions: {
            ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] },
          },
          rules: [
            {
              type: "pull_request",
              parameters: { allowed_merge_methods: ["squash"] },
            },
            {
              type: "required_status_checks",
              parameters: {
                strict_required_status_checks_policy: true,
                required_status_checks: checks
                  .filter(({ name }) => !state.observation || name !== gate)
                  .map(({ name, id }) => ({
                    context: name,
                    integration_id: id,
                  })),
              },
            },
          ],
        });
      }
      if (url === repoUrl) {
        return Response.json({ id: 8, default_branch: "main" });
      }
      if (url.includes("/check-runs")) {
        if (url.includes(testSha)) {
          return Response.json({ total_count: 0, check_runs: [] });
        }
        const runs = checks
          .filter(
            (item) => item.name !== "Quality checks" || !state.missingCheck,
          )
          .map(({ name, id }) => ({
            name:
              state.observation && name === gate
                ? `${gate} (observation)`
                : name,
            head_sha: candidate.headSha,
            status:
              name === "Quality checks" && state.check === "pending"
                ? "in_progress"
                : "completed",
            conclusion:
              name === "Quality checks"
                ? state.check === "pending"
                  ? null
                  : state.check
                : "success",
            external_id:
              name === gate && !state.staleGate
                ? `work:91:pr:92:${candidate.headSha}:${candidate.baseSha}`
                : null,
            app: { id: name === gate && state.untrustedGate ? 999 : id },
          }));
        return Response.json({ total_count: runs.length, check_runs: runs });
      }
      throw new Error(`Unexpected fixture URL ${url}`);
    },
  );
  function publisher(): WorkMergePublisher {
    return {
      repository,
      repositoryId: 8,
      actorId: state.actorId,
      projectId: "project",
      projectsToken: "fixture",
      repositoryToken: "fixture",
      fetchImpl,
      activation: {
        workState: true,
        dependencies: true,
        workIntegrationPr: true,
        priority: false,
        routes: false,
        taskParent: true,
        taskClaim: false,
      },
      readGrant: async () => grant,
      withinVerifiedBoundary: async (_candidate, _mode, action) =>
        state.boundary ? action() : null,
    };
  }
  return { state, writes, fetchImpl, publisher };
}

describe("trusted Work integration publisher", () => {
  it.each(["direct", "auto"] as const)(
    "observes %s without any mutation",
    async (mode) => {
      const f = fixture();
      f.state.observation = true;
      f.state.check = mode === "auto" ? "pending" : "success";
      await expect(
        observeWorkMerge(f.publisher(), candidate, mode),
      ).resolves.toEqual({ status: "observed-checks-passed" });
      expect(f.writes).toEqual([]);
    },
  );

  it("checks live owners and performs a head-pinned squash only once", async () => {
    const f = fixture();
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({ status: "merged", sha: mergeSha });
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({ status: "already-merged", sha: mergeSha });
    expect(f.writes).toEqual([
      {
        url: `${repoUrl}/pulls/92/merge`,
        method: "PUT",
        body: {
          sha: candidate.headSha,
          merge_method: "squash",
          commit_title: f.state.title,
          commit_message: "Refs #91",
        },
      },
    ]);
  });

  it.each([
    { change: { actorId: 666 }, reason: "MERGE_NOT_DELEGATED" },
    { change: { boundary: false }, reason: "FRESHNESS_BOUNDARY_UNVERIFIED" },
    { change: { missingReview: true }, reason: "TRUSTED_EVIDENCE_UNAVAILABLE" },
    {
      change: { missingApproval: true },
      reason: "TRUSTED_EVIDENCE_UNAVAILABLE",
    },
    {
      change: { revokedDecision: true },
      reason: "STALE_OR_UNACCEPTED_EVIDENCE:working-decisions",
    },
    { change: { workState: "Reviewing" }, reason: "WORK_NOT_ELIGIBLE" },
    { change: { dependencyOpen: true }, reason: "WORK_NOT_ELIGIBLE" },
    { change: { moving: "head" }, reason: "CANDIDATE_CHANGED" },
    { change: { moving: "target" }, reason: "CANDIDATE_CHANGED" },
    {
      change: { check: "failure" },
      reason: "CHECK_NOT_SUCCESSFUL:Quality checks",
    },
    {
      change: { missingCheck: true },
      reason: "UNVERIFIED_CHECK:Quality checks",
    },
    { change: { untrustedGate: true }, reason: `UNVERIFIED_CHECK:${gate}` },
    { change: { staleGate: true }, reason: "STALE_WORK_MERGE_GATE" },
    { change: { closingIssues: 1 }, reason: "NATIVE_ISSUE_CLOSURE_UNVERIFIED" },
    {
      change: { title: "fix: closes #91" },
      reason: "NATIVE_ISSUE_CLOSURE_UNVERIFIED",
    },
  ])("refuses $reason without mutation", async ({ change, reason }) => {
    const f = fixture();
    Object.assign(f.state, change);
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({ status: "blocked", reason });
    expect(f.writes).toEqual([]);
  });

  it("rereads GitHub after a lost merge response", async () => {
    const f = fixture();
    f.state.mergeTimeout = true;
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({ status: "merged", sha: mergeSha });
    expect(f.writes).toHaveLength(1);
  });

  it("arms native squash for pending CI only with a verified waiting boundary", async () => {
    const f = fixture();
    f.state.check = "pending";
    f.state.boundary = false;
    await expect(
      publishWorkMerge(f.publisher(), candidate, "auto"),
    ).resolves.toMatchObject({ status: "blocked" });
    expect(f.writes).toHaveLength(0);
    f.state.boundary = true;
    await expect(
      publishWorkMerge(f.publisher(), candidate, "auto"),
    ).resolves.toEqual({ status: "auto-merge-requested" });
    await expect(
      publishWorkMerge(f.publisher(), candidate, "auto"),
    ).resolves.toEqual({
      status: "blocked",
      reason: "EXISTING_AUTO_MERGE_REQUEST",
    });
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]?.body).toMatchObject({
      variables: {
        input: {
          pullRequestId: "pr-node",
          expectedHeadOid: candidate.headSha,
          mergeMethod: "SQUASH",
        },
      },
    });
  });
});
