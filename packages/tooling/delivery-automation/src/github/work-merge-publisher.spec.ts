import { describe, expect, it, vi } from "vitest";

import type { MergeReservation } from "../control/merge-reservation.js";
import {
  executeWorkIntegrationOperation,
  type WorkIntegrationReservationReceipt,
} from "../control/work-integration-controller.js";
import { performReservedGitHubIntegration } from "./reserved-work-integration.js";
import {
  armReservedWorkSquash,
  cancelReservedNativeSquash,
  evaluateScopedWorkGate,
  observeReservedWorkSquash,
  observeWorkMerge,
  publishWorkMerge,
  readAcceptedStandingImpact,
  releaseReservedWorkMergeGate,
  type WorkGateEvaluationGrant,
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

const reservedCheckId = 133;
const controllerBotId = 123;
const checkIssuerToken = "isolated-check-issuer-fixture";
const reservationId = "delivery-control/r12";
const armIntent = {
  candidate,
  state: {
    phase: "pending",
    operation: "arm-squash",
    checkId: reservedCheckId,
  },
} as const;

const evaluationCandidate = { ...candidate, workNumber: 120, pullNumber: 125 };

function fixture(scoped = false) {
  const target = scoped ? evaluationCandidate : candidate;
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
    supersededQualityCheck: null as {
      conclusion: string;
      startedAt: string;
    } | null,
    untrustedGate: false,
    staleGate: false,
    reservedGate: null as "queued" | "completed" | null,
    reservedGateOnTestMerge: false,
    priorGreenGate: false,
    incompleteGateInventory: false,
    armTimeout: false,
    cancelTimeout: false,
    mergeDuringCancel: false,
    mergeParent: candidate.baseSha,
    mergeOnMain: true,
    mergeTimeout: false,
    receiptTimeout: false,
    receiptUnexpected: false,
    merged: false,
    armed: false,
    armBotId: controllerBotId,
    observation: false,
    bypassActors: [] as readonly unknown[] | null | undefined,
    strictChecks: true,
    mergeMethod: "squash",
    closingIssues: 0,
    title: "feat: integrate ordinary Work",
    evidenceEdited: false,
    standingImpact: "ordinary",
    standingFactsDigest: "d".repeat(64),
    revokeGrant: false,
    tasks: [] as unknown[],
    owningPullBody: `Refs #${target.workNumber}`,
    additionalPullBody: null as string | null,
  };
  const grant: WorkMergeGrant = {
    actorId: 12,
    repositoryId: 8,
    workNumber: target.workNumber,
    pullNumber: target.pullNumber,
    requiredTasks: [],
    gateAppId: scoped ? 5625775 : 7,
    rulesetId: 9,
    direct: true,
    auto: !scoped,
    evidence: [
      { kind: "code-review", commentId: 1, authorId: 12 },
      { kind: "working-decisions", commentId: 2, authorId: 12 },
      {
        kind: "validation",
        commentId: 3,
        authorId: 13,
      },
      ...(scoped
        ? []
        : [
            {
              kind: "functional-approval" as const,
              commentId: 4,
              authorId: 13,
            },
          ]),
    ],
  };
  const writes: { url: string; method: string; body: unknown }[] = [];
  const receipts = new Set<string>();
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
                number: target.workNumber,
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
      if (url === `${repoUrl}/commits/${mergeSha}`) {
        return Response.json({
          sha: mergeSha,
          parents: [{ sha: state.mergeParent }],
        });
      }
      if (url === `${repoUrl}/compare/${mergeSha}...main`) {
        return Response.json({
          status: state.mergeOnMain ? "ahead" : "diverged",
          merge_base_commit: { sha: state.mergeOnMain ? mergeSha : testSha },
        });
      }
      if (url.endsWith("/git/refs")) {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer isolated-merge-fixture",
        );
        const request = body as { ref: string; sha: string };
        expect(request.ref).toBe(
          `refs/tags/delivery-direct/work-91-pr-92/${candidate.headSha}-${candidate.baseSha}`,
        );
        if (receipts.has(request.ref)) {
          return new Response(null, { status: 422 });
        }
        receipts.add(request.ref);
        if (state.receiptTimeout) {
          throw new Error("lost receipt response");
        }
        return Response.json(
          {
            ref: request.ref,
            object: {
              type: "commit",
              sha: state.receiptUnexpected ? mergeSha : request.sha,
            },
          },
          { status: 201 },
        );
      }
      if (url.endsWith("/pulls/92/merge")) {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer isolated-merge-fixture",
        );
        writes.push({ url, method: "PUT", body });
        state.merged = true;
        if (state.mergeTimeout) {
          throw new Error("lost response");
        }
        return Response.json({ merged: true, sha: mergeSha });
      }
      if (
        url === "https://api.github.com/graphql" &&
        String(init?.body).includes("disablePullRequestAutoMerge")
      ) {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer isolated-merge-fixture",
        );
        writes.push({ url, method: "POST", body });
        state.armed = false;
        state.merged = state.mergeDuringCancel;
        if (state.cancelTimeout) {
          throw new Error("native cancellation response lost");
        }
        return Response.json({
          data: {
            disablePullRequestAutoMerge: {
              clientMutationId: reservationId,
              pullRequest: { id: "pr-node", autoMergeRequest: null },
            },
          },
        });
      }
      if (
        url === "https://api.github.com/graphql" &&
        String(init?.body).includes("enablePullRequestAutoMerge")
      ) {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer isolated-merge-fixture",
        );
        writes.push({ url, method: "POST", body });
        state.armed = true;
        if (state.armTimeout) {
          throw new Error("native arm response lost");
        }
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
      if (url.endsWith(`/pulls/${target.pullNumber}`)) {
        const changed = ++prReads >= 5;
        return Response.json({
          number: target.pullNumber,
          node_id: "pr-node",
          title: state.title,
          body: state.owningPullBody,
          draft: false,
          state: state.merged ? "closed" : "open",
          mergeable: true,
          merged: state.merged,
          merge_commit_sha: state.merged ? mergeSha : testSha,
          auto_merge: state.armed
            ? {
                merge_method: "squash",
                enabled_by: { type: "Bot", id: state.armBotId },
              }
            : null,
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
      if (url.endsWith("/pulls/131") && state.additionalPullBody !== null) {
        return Response.json({
          number: 131,
          body: state.additionalPullBody,
          state: "open",
          base: { ref: "main" },
          head: { ref: "codex/111", repo: { full_name: repository } },
        });
      }
      if (url.includes(`/issues/${target.workNumber}/timeline`)) {
        const numbers =
          state.additionalPullBody === null
            ? [target.pullNumber]
            : [target.pullNumber, 131];
        return Response.json(
          numbers.map((number) => ({
            event: "cross-referenced",
            source: {
              issue: {
                number,
                repository_url: repoUrl,
                pull_request: {},
              },
            },
          })),
        );
      }
      if (url.includes("/dependencies/blocked_by")) {
        return Response.json(state.dependencyOpen ? [{ state: "open" }] : []);
      }
      if (url.includes("/sub_issues")) {
        return Response.json(state.tasks);
      }
      if (url.includes("/issues/comments/")) {
        const id = Number(url.split("/").at(-1));
        if (
          (id === 1 && state.missingReview) ||
          (id === (scoped ? 3 : 4) && state.missingApproval)
        ) {
          return new Response(null, { status: 404 });
        }
        const reference = grant.evidence.find((item) => item.commentId === id);
        return Response.json({
          id,
          issue_url: `${repoUrl}/issues/${target.workNumber}`,
          user: { id: reference?.authorId, type: "User" },
          performed_via_github_app: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: state.evidenceEdited
            ? "2026-01-02T00:00:00Z"
            : "2026-01-01T00:00:00Z",
          body: JSON.stringify({
            ...target,
            kind: reference?.kind,
            standingImpact: state.standingImpact,
            standingFactsDigest: state.standingFactsDigest,
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
          bypass_actors: state.bypassActors,
          conditions: {
            ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] },
          },
          rules: [
            {
              type: "pull_request",
              parameters: { allowed_merge_methods: [state.mergeMethod] },
            },
            {
              type: "required_status_checks",
              parameters: {
                strict_required_status_checks_policy: state.strictChecks,
                required_status_checks: checks
                  .filter(
                    ({ name }) => scoped || !state.observation || name !== gate,
                  )
                  .map(({ name, id }) => ({
                    context: name,
                    integration_id: scoped && name === gate ? 5625775 : id,
                  })),
              },
            },
          ],
        });
      }
      if (url === repoUrl) {
        return Response.json({ id: 8, default_branch: "main" });
      }
      if (
        url === `${repoUrl}/check-runs` ||
        url === `${repoUrl}/check-runs/${reservedCheckId}`
      ) {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${checkIssuerToken}`,
        );
        if (init?.method === "POST") {
          writes.push({ url, method: "POST", body });
          state.reservedGate = "queued";
        }
        if (init?.method === "PATCH") {
          expect(state.armed).toBe(true);
          writes.push({ url, method: "PATCH", body });
          state.reservedGate = "completed";
        }
        return Response.json(
          {
            id: reservedCheckId,
            html_url: "https://github.com/Oxelio/architecture-web/runs/133",
            name: gate,
            head_sha: candidate.headSha,
            external_id: reservationId,
            app: { id: 7 },
            status: state.reservedGate,
            conclusion: state.reservedGate === "completed" ? "success" : null,
          },
          { status: init?.method === "POST" ? 201 : 200 },
        );
      }
      if (url.includes("/check-runs")) {
        const onTestMerge = url.includes(testSha);
        if (onTestMerge && !state.reservedGateOnTestMerge) {
          return Response.json({ total_count: 0, check_runs: [] });
        }
        const runs = checks
          .filter(({ name }) => !onTestMerge || name === gate)
          .filter(
            (item) => item.name !== "Quality checks" || !state.missingCheck,
          )
          .map(({ name, id }) => ({
            id: name === gate ? reservedCheckId : id,
            name:
              state.observation && name === gate
                ? `${gate} (observation)`
                : name,
            head_sha: onTestMerge ? testSha : candidate.headSha,
            started_at: "2026-01-02T00:00:00Z",
            status:
              name === gate && state.reservedGate
                ? state.reservedGate
                : name === "Quality checks" && state.check === "pending"
                  ? "in_progress"
                  : "completed",
            conclusion:
              name === "Quality checks"
                ? state.check === "pending"
                  ? null
                  : state.check
                : name === gate && state.reservedGate === "queued"
                  ? null
                  : "success",
            external_id:
              name === gate && !state.staleGate
                ? state.reservedGate
                  ? reservationId
                  : `work:91:pr:92:${candidate.headSha}:${candidate.baseSha}`
                : null,
            app: { id: name === gate && state.untrustedGate ? 999 : id },
          }));
        if (url.includes("filter=all")) {
          const gates = runs.filter((check) => check.name === gate);
          const [current] = gates;
          if (current && state.priorGreenGate) {
            gates.push({
              ...current,
              id: reservedCheckId - 1,
              external_id: "delivery-control/r1",
              status: "completed",
              conclusion: "success",
            });
          }
          return Response.json({
            total_count: gates.length + (state.incompleteGateInventory ? 1 : 0),
            check_runs: gates,
          });
        }
        if (state.supersededQualityCheck) {
          const quality = runs.find(({ name }) => name === "Quality checks");
          if (quality) {
            runs.push({
              ...quality,
              conclusion: state.supersededQualityCheck.conclusion,
              started_at: state.supersededQualityCheck.startedAt,
            });
          }
        }
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
      mergeToken: "isolated-merge-fixture",
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
      readGrant: async () => (state.revokeGrant ? null : grant),
      withinVerifiedBoundary: async (_candidate, _mode, action) =>
        state.boundary ? action() : null,
    };
  }
  const evaluationGrant: WorkGateEvaluationGrant = {
    ...target,
    actorId: grant.actorId,
    repositoryId: grant.repositoryId,
    evidence: grant.evidence,
    requiredTasks: grant.requiredTasks,
    gateAppId: grant.gateAppId,
    rulesetId: grant.rulesetId,
    purpose: "evaluate-work-merge-gate",
    expiresAt: "2099-01-01T00:00:00Z",
    requiredEvidence: grant.evidence.map(({ kind }) => kind),
  };
  const evaluator = (overrides: Partial<WorkGateEvaluationGrant> = {}) => ({
    ...publisher(),
    readGrant: async () => ({ ...evaluationGrant, ...overrides }),
  });
  return { state, writes, fetchImpl, publisher, evaluator, receipts };
}

describe("evaluated Work Merge Gate", () => {
  it("ignores incidental references by a PR that declares a different owning Work", async () => {
    const f = fixture(true);
    f.state.additionalPullBody = `Refs #111\n\nReconcile with #${evaluationCandidate.workNumber} before merging.`;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({ pass: true });
    expect(f.writes).toEqual([]);
  });

  it("reports competing ownership before any mutation", async () => {
    const f = fixture(true);
    f.state.additionalPullBody = `Refs #${evaluationCandidate.workNumber}`;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).rejects.toThrow("WORK_INTEGRATION_PR_AMBIGUOUS");
    expect(f.writes).toEqual([]);
  });

  it("reports unavailable ownership when the candidate has only an incidental reference", async () => {
    const f = fixture(true);
    f.state.owningPullBody = `Related to #${evaluationCandidate.workNumber}`;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).rejects.toThrow("WORK_INTEGRATION_PR_UNAVAILABLE");
    expect(f.writes).toEqual([]);
  });

  it("uses the newest same-issuer CI attempt, without accepting ambiguous ordering", async () => {
    const f = fixture(true);
    f.state.supersededQualityCheck = {
      conclusion: "failure",
      startedAt: "2026-01-01T00:00:00Z",
    };
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({ pass: true });
    f.state.supersededQualityCheck.startedAt = "2026-01-03T00:00:00Z";
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({ pass: false });
    f.state.supersededQualityCheck.startedAt = "2026-01-02T00:00:00Z";
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({ pass: false });
  });

  it("evaluates accepted evidence and existing CI without consulting a prior Gate or mutating GitHub", async () => {
    const f = fixture(true);
    f.state.observation = true;
    f.state.bypassActors = undefined;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({
      pass: true,
      grantsMergeAuthority: false,
      impliesDone: false,
    });
    expect(f.writes).toEqual([]);
    expect(f.receipts.size).toBe(0);
  });

  it("reflects failed Work evidence and CI in the Gate decision", async () => {
    const f = fixture(true);
    f.state.workState = "Reviewing";
    f.state.check = "failure";
    f.state.tasks.push({ number: 100 });
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).resolves.toMatchObject({
      pass: false,
      blockers: expect.arrayContaining([
        "WORK_NOT_VALIDATING",
        "TASK_DISPOSITION_INCOMPLETE",
        "REPOSITORY_CHECKS_UNSATISFIED",
      ]),
    });
  });

  it("rejects stale or out-of-scope candidates and unaccepted evidence", async () => {
    const f = fixture(true);
    await expect(
      evaluateScopedWorkGate(f.evaluator(), {
        ...evaluationCandidate,
        headSha: mergeSha,
      }),
    ).rejects.toThrow("EVALUATED_GATE_NOT_AUTHORIZED");
    await expect(
      evaluateScopedWorkGate(f.evaluator(), candidate),
    ).rejects.toThrow("EVALUATED_GATE_NOT_AUTHORIZED");
    f.state.revokedDecision = true;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).rejects.toThrow("STALE_OR_UNACCEPTED_EVIDENCE");
  });

  it("rejects missing applicable human authority evidence and edited evidence", async () => {
    const f = fixture(true);
    await expect(
      evaluateScopedWorkGate(
        f.evaluator({
          requiredEvidence: [
            "code-review",
            "validation",
            "working-decisions",
            "functional-approval",
          ],
        }),
        evaluationCandidate,
      ),
    ).rejects.toThrow("EVALUATED_GATE_NOT_AUTHORIZED");
    f.state.evidenceEdited = true;
    await expect(
      evaluateScopedWorkGate(f.evaluator(), evaluationCandidate),
    ).rejects.toThrow("UNVERIFIED_EVIDENCE");
  });
});

describe("trusted Work integration publisher", () => {
  it("requires a credential separate from the read token before attempting mutation", async () => {
    const f = fixture();
    await expect(
      publishWorkMerge(
        { ...f.publisher(), mergeToken: "fixture" },
        candidate,
        "direct",
      ),
    ).resolves.toEqual({
      status: "blocked",
      reason: "ISOLATED_MERGE_CREDENTIAL_REQUIRED",
    });
    expect(f.writes).toHaveLength(0);
  });

  it.each(["direct", "auto"] as const)(
    "observes %s without any mutation",
    async (mode) => {
      const f = fixture();
      f.state.observation = true;
      f.state.check = mode === "auto" ? "pending" : "success";
      await expect(
        observeWorkMerge(f.publisher(), candidate, mode),
      ).resolves.toEqual({
        status: "observed-checks-passed",
        bypassActors: "none",
      });
      expect(f.writes).toEqual([]);
    },
  );

  it("reports omitted bypass actors as unverified in read-only observation", async () => {
    const f = fixture();
    f.state.observation = true;
    f.state.bypassActors = undefined;
    await expect(
      observeWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({
      status: "observed-checks-passed",
      bypassActors: "unverified",
    });
    expect(f.writes).toEqual([]);
  });

  it.each(["direct", "auto"] as const)(
    "blocks a real %s operation when bypass actors are omitted",
    async (mode) => {
      const f = fixture();
      f.state.bypassActors = undefined;
      f.state.check = mode === "auto" ? "pending" : "success";
      await expect(
        publishWorkMerge(f.publisher(), candidate, mode),
      ).resolves.toEqual({
        status: "blocked",
        reason: "REQUIRED_PROTECTIONS_UNVERIFIED",
      });
      expect(f.writes).toEqual([]);
    },
  );

  it.each([
    { bypassActors: [{ actor_id: 123 }] },
    { bypassActors: null },
    { bypassActors: undefined, strictChecks: false },
    { bypassActors: undefined, mergeMethod: "merge" },
  ])(
    "rejects incompatible protection data in observation: %j",
    async (change) => {
      const f = fixture();
      f.state.observation = true;
      Object.assign(f.state, change);
      await expect(
        observeWorkMerge(f.publisher(), candidate, "direct"),
      ).resolves.toEqual({
        status: "blocked",
        reason: "REQUIRED_PROTECTIONS_UNVERIFIED",
      });
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
    expect(f.receipts.size).toBe(1);
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

  it("keeps the receipt across runs even if GitHub's create response was lost", async () => {
    const f = fixture();
    f.state.receiptTimeout = true;
    const expected = {
      status: "blocked",
      reason: "DIRECT_REQUEST_CONSUMPTION_UNCONFIRMED",
    };
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual(expected);
    f.state.receiptTimeout = false;
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual(expected);
    expect(f.receipts.size).toBe(1);
    expect(f.writes).toEqual([]);
  });

  it("does not squash when the receipt response identifies another object", async () => {
    const f = fixture();
    f.state.receiptUnexpected = true;
    await expect(
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ).resolves.toEqual({
      status: "blocked",
      reason: "DIRECT_REQUEST_CONSUMPTION_UNCONFIRMED",
    });
    expect(f.writes).toEqual([]);
  });

  it("allows at most one squash attempt across concurrent publishers", async () => {
    const f = fixture();
    await Promise.all([
      publishWorkMerge(f.publisher(), candidate, "direct"),
      publishWorkMerge(f.publisher(), candidate, "direct"),
    ]);
    expect(f.receipts.size).toBe(1);
    expect(f.writes).toHaveLength(1);
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

describe("reserved native squash", () => {
  it("uses the reserved queued check as the only pending prerequisite", async () => {
    const f = fixture();
    f.state.reservedGate = "queued";
    await expect(
      armReservedWorkSquash(f.publisher(), armIntent, reservationId),
    ).resolves.toEqual({ status: "auto-merge-requested" });
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

  it("rejects already-green, foreign, replaced, or unverifiable checks before arming", async () => {
    for (const change of [
      { reservedGate: "completed" },
      { untrustedGate: true },
      { reservedGateOnTestMerge: true },
      { staleGate: true },
      { boundary: false },
      { check: "pending" },
      { bypassActors: undefined },
    ] as const) {
      const f = fixture();
      f.state.reservedGate = "queued";
      Object.assign(f.state, change);
      await expect(
        armReservedWorkSquash(f.publisher(), armIntent, reservationId),
      ).resolves.toMatchObject({ status: "blocked" });
      expect(f.writes).toHaveLength(0);
    }
  });

  it("rejects a hidden prior green check or incomplete history even when the latest check is queued", async () => {
    for (const change of [
      { priorGreenGate: true },
      { incompleteGateInventory: true },
    ]) {
      const f = fixture();
      f.state.reservedGate = "queued";
      Object.assign(f.state, change);
      await expect(
        armReservedWorkSquash(f.publisher(), armIntent, reservationId),
      ).resolves.toMatchObject({ status: "blocked" });
      expect(f.writes).toHaveLength(0);
    }
  });

  it("rejects an unrelated reserved check ID", async () => {
    const f = fixture();
    f.state.reservedGate = "queued";
    await expect(
      armReservedWorkSquash(
        f.publisher(),
        { ...armIntent, state: { ...armIntent.state, checkId: 134 } },
        reservationId,
      ),
    ).resolves.toMatchObject({ status: "blocked" });
    expect(f.writes).toHaveLength(0);
  });

  it("does not replay an arm when its response was lost", async () => {
    const f = fixture();
    f.state.reservedGate = "queued";
    f.state.armTimeout = true;
    await expect(
      armReservedWorkSquash(f.publisher(), armIntent, reservationId),
    ).resolves.toEqual({
      status: "uncertain",
      reason: "MUTATION_NOT_CONFIRMED",
    });
    expect(f.writes).toHaveLength(1);
  });
});

describe("reserved squash outcome", () => {
  it("confirms the exact squash in protected main without issuing a mutation", async () => {
    const f = fixture();
    f.state.merged = true;
    await expect(
      observeReservedWorkSquash(f.publisher(), candidate),
    ).resolves.toEqual({
      kind: "squash-merged",
      sha: mergeSha,
    });
    expect(f.writes).toHaveLength(0);
  });

  it("keeps the outcome unresolved on a wrong parent, changed owner, or absent merge", async () => {
    for (const state of [
      { mergeOnMain: false },
      { mergeParent: testSha },
      { owningPullBody: "Refs #93" },
      { merged: false, armed: false },
    ]) {
      const f = fixture();
      f.state.merged = true;
      Object.assign(f.state, state);
      await expect(
        observeReservedWorkSquash(f.publisher(), candidate),
      ).resolves.toBeNull();
      expect(f.writes).toHaveLength(0);
    }
  });
});

describe("reserved gate release", () => {
  const releaseIntent = {
    candidate,
    state: {
      phase: "pending",
      operation: "release-check",
      checkId: reservedCheckId,
    },
  } as const;

  it("keeps the same check pending until the durable arm and releases that check only", async () => {
    const f = fixture();
    let current: WorkIntegrationReservationReceipt = {
      revision: 1,
      reservation: { candidate, state: { phase: "reserved" } },
    };
    const publisher = f.publisher();
    const ports: Parameters<
      typeof executeWorkIntegrationOperation
    >[0]["ports"] = {
      readReservation: async () => current,
      append: async (
        previous: WorkIntegrationReservationReceipt,
        reservation: MergeReservation,
      ) => {
        if (previous.revision !== current.revision) {
          return null;
        }
        current = { revision: current.revision + 1, reservation };
        return current;
      },
      authorize: async () => true,
      perform: ({ reservation }) =>
        performReservedGitHubIntegration(reservation, {
          publisher,
          reservationId,
          checksToken: checkIssuerToken,
          checksAppId: 7,
          controllerBotId,
        }),
    };
    for (const operation of [
      "queue-check",
      "arm-squash",
      "release-check",
    ] as const) {
      await expect(
        executeWorkIntegrationOperation({
          candidate,
          operation,
          standingEnabled: true,
          ports,
        }),
      ).resolves.toMatchObject({ status: "confirmed" });
    }
    expect(current.reservation.state).toEqual({
      phase: "released",
      checkId: reservedCheckId,
    });
    expect(f.writes.map(({ method, url }) => [method, url])).toEqual([
      ["POST", `${repoUrl}/check-runs`],
      ["POST", "https://api.github.com/graphql"],
      ["PATCH", `${repoUrl}/check-runs/${reservedCheckId}`],
    ]);
  });

  it("keeps the check pending if the request changed or current authority was revoked", async () => {
    for (const change of [
      { armed: false },
      { armBotId: controllerBotId + 1 },
      { revokedDecision: true },
      { dependencyOpen: true },
      { boundary: false },
    ]) {
      const f = fixture();
      f.state.armed = true;
      f.state.reservedGate = "queued";
      Object.assign(f.state, change);
      await expect(
        releaseReservedWorkMergeGate(
          f.publisher(),
          releaseIntent,
          reservationId,
          checkIssuerToken,
          controllerBotId,
        ),
      ).resolves.toMatchObject({ status: "blocked" });
      expect(f.writes).toHaveLength(0);
      expect(f.state.reservedGate).toBe("queued");
    }
  });
});

describe("reserved native cancellation", () => {
  const scope = {
    reservationId,
    checksAppId: 7,
    rulesetId: 9,
    controllerBotId,
  };
  const cancel = (previousPhase: "armed" | "released") =>
    ({
      candidate,
      state: {
        phase: "pending",
        operation: "resolve",
        checkId: reservedCheckId,
        previousPhase,
      },
    }) as const;

  it("confirms cancellation only when the exact check held the merge throughout", async () => {
    const f = fixture();
    f.state.armed = true;
    f.state.reservedGate = "queued";
    await expect(
      cancelReservedNativeSquash(f.publisher(), cancel("armed"), scope),
    ).resolves.toEqual({ kind: "squash-cancelled" });
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]?.body).toMatchObject({
      variables: {
        input: { pullRequestId: "pr-node", clientMutationId: reservationId },
      },
    });
  });

  it("treats lost responses and acknowledgements after release as unresolved", async () => {
    for (const previousPhase of ["armed", "released"] as const) {
      const f = fixture();
      f.state.armed = true;
      f.state.cancelTimeout = previousPhase === "armed";
      f.state.reservedGate = previousPhase === "armed" ? "queued" : "completed";
      await expect(
        cancelReservedNativeSquash(f.publisher(), cancel(previousPhase), scope),
      ).resolves.toBeNull();
      expect(f.writes).toHaveLength(1);
    }
  });

  it("preserves the verified squash when merge wins the race", async () => {
    const f = fixture();
    f.state.armed = true;
    f.state.reservedGate = "completed";
    f.state.mergeDuringCancel = true;
    await expect(
      cancelReservedNativeSquash(f.publisher(), cancel("released"), scope),
    ).resolves.toEqual({ kind: "squash-merged", sha: mergeSha });
    expect(f.writes).toHaveLength(1);
  });

  it("does not cancel outside the controller's verified writer boundary", async () => {
    const f = fixture();
    f.state.armed = true;
    f.state.reservedGate = "queued";
    f.state.boundary = false;
    await expect(
      cancelReservedNativeSquash(f.publisher(), cancel("armed"), scope),
    ).resolves.toBeNull();
    expect(f.writes).toHaveLength(0);
  });
});

describe("standing impact evidence reader", () => {
  const scope = (f: ReturnType<typeof fixture>) => ({
    ...f.publisher(),
    repository: "Oxelio/architecture-web",
  });

  it("uses the accepted candidate-bound Code Review record", async () => {
    const f = fixture();
    expect(await readAcceptedStandingImpact(scope(f), candidate)).toEqual({
      candidate,
      disposition: "ordinary",
      factsDigest: "d".repeat(64),
    });
    expect(f.writes).toHaveLength(0);
  });

  it("fails closed when evidence is edited, missing, malformed or revoked", async () => {
    for (const fault of [
      { evidenceEdited: true },
      { missingReview: true },
      { standingFactsDigest: "invalid" },
      { revokeGrant: true },
      { tasks: [{ number: 123, state: "open" }] },
    ]) {
      const f = fixture();
      Object.assign(f.state, fault);
      expect(await readAcceptedStandingImpact(scope(f), candidate)).toBeNull();
      expect(f.writes).toHaveLength(0);
    }
  });

  it("rejects a grant revoked during evidence resolution", async () => {
    const f = fixture();
    const publisher = scope(f);
    let reads = 0;
    expect(
      await readAcceptedStandingImpact(
        {
          ...publisher,
          readGrant: () =>
            ++reads === 1 ? publisher.readGrant() : Promise.resolve(null),
        },
        candidate,
      ),
    ).toBeNull();
  });
});
