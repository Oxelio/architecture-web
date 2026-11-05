import { afterEach, expect, it, vi } from "vitest";

const { readFile, manifest, readTarget, evaluateGate } = vi.hoisted(() => ({
  readFile: vi.fn(),
  manifest: vi.fn(),
  readTarget: vi.fn(),
  evaluateGate: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({ readFile }));
vi.mock("../github/work-integration-target.js", () => ({
  readAuthorizedWorkIntegrationTarget: readTarget,
}));
vi.mock("../github/work-merge-publisher.js", () => ({
  evaluateScopedWorkGate: evaluateGate,
}));
vi.mock("../github/github-project-inventory.js", () => ({
  readGitHubInventory: async () => ({}),
}));
vi.mock("../config/activation-context.js", () => ({
  resolveActivationContext: () => ({
    status: "available",
    project: { id: "PVT" },
    activation: {},
  }),
}));
vi.mock("./gate-publication-support.js", async (original) => ({
  ...(await original<typeof import("./gate-publication-support.js")>()),
  readActivationManifest: manifest,
}));

const root = "https://api.github.com/repos/Oxelio/architecture-web";
const repo = { id: 1336937640 };
const actor = { id: 83680141, type: "User" };
const candidate = {
  workNumber: 96,
  pullNumber: 98,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const mergeSha = "c".repeat(40);
const now = "2026-11-05T00:01:00Z";
const created = "2026-11-05T00:00:00Z";
const originalExit = process.exitCode;

afterEach(() => {
  process.exitCode = originalExit;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function workflow(name: string, event: object) {
  for (const [key, value] of Object.entries({
    GITHUB_EVENT_NAME: name,
    GITHUB_REPOSITORY: "Oxelio/architecture-web",
    GITHUB_REPOSITORY_ID: "1336937640",
    GITHUB_REF: "refs/heads/main",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_SHA: mergeSha,
    TRUSTED_WORKFLOW_SHA: mergeSha,
    GITHUB_EVENT_PATH: "event.json",
    GITHUB_ACTOR_ID: "83680141",
    GITHUB_TOKEN: "repository-fixture",
  })) {
    vi.stubEnv(key, value);
  }
  manifest.mockResolvedValue({
    project: { owner: "Oxelio", number: 3 },
    mappings: {
      workState: { status: "verified" },
      workIntegrationPr: { status: "verified" },
    },
  });
  readFile.mockResolvedValue(JSON.stringify({ repository: repo, ...event }));
  const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  return () => JSON.parse(String(out.mock.calls[0]?.[0])) as unknown;
}

function comment(id: number, work: number, body: string) {
  return {
    id,
    issue_url: `${root}/issues/${work}`,
    user: actor,
    body,
    created_at: created,
    updated_at: created,
    performed_via_github_app: null,
  };
}

function requestFixture() {
  const body = `/architecture-web direct-squash\n${JSON.stringify(candidate)}`;
  const request = {
    ...comment(12, 98, body),
    performed_via_github_app: { id: 1144995 },
  };
  const grant = comment(
    13,
    91,
    JSON.stringify({
      ...candidate,
      actorId: actor.id,
      appId: 1144995,
      repositoryId: repo.id,
      operation: "direct-squash",
      expiresAt: "2026-11-05T00:05:00Z",
    }),
  );
  const result = workflow("issue_comment", {
    action: "created",
    repository: { ...repo, default_branch: "main" },
    sender: actor,
    issue: { number: 98, pull_request: {} },
    comment: request,
  });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  vi.stubEnv("DELIVERY_DIRECT_GRANT_COMMENT_ID", "13");
  readTarget.mockResolvedValue({
    status: "selected",
    target: { pullRequestNumber: 98, headSha: candidate.headSha },
  });
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      expect(init?.method).toBe("GET");
      switch (String(input).slice(root.length)) {
        case "/issues/comments/12":
          return Response.json(request);
        case "/issues/comments/13":
          return Response.json(grant);
        case "/branches/main":
          return Response.json({ commit: { sha: candidate.baseSha } });
        case "/pulls/98":
          return Response.json({
            number: 98,
            state: "open",
            draft: false,
            merged: false,
            head: { repo, sha: candidate.headSha },
            base: { repo, ref: "main", sha: candidate.baseSha },
          });
        default:
          throw new Error("Unexpected GitHub request");
      }
    });
  return { result, fetch, grant };
}

it("authenticates a fresh connector request with repository reads only", async () => {
  const { result, fetch } = requestFixture();
  await import("./work-integration-request.js");
  expect(result()).toMatchObject({ status: "authenticated", candidate });
  expect(
    fetch.mock.calls.filter(([url]) =>
      String(url).endsWith("/issues/comments/13"),
    ),
  ).toHaveLength(2);
});

it("does not accept a connector-authored maintainer grant", async () => {
  const { result, grant } = requestFixture();
  Object.assign(grant, { performed_via_github_app: { id: 1144995 } });
  await import("./work-integration-request.js");
  expect(result()).toMatchObject({
    status: "blocked",
    reason: "REQUEST_GRANT_UNVERIFIED",
  });
});

function completionFixture(recovery = false) {
  const result = workflow(
    recovery ? "workflow_dispatch" : "pull_request_target",
    recovery
      ? { inputs: { pull_number: "98" } }
      : { pull_request: { number: 98, merged: true } },
  );
  vi.stubEnv("PILOT_PULL_NUMBER", "98");
  vi.stubEnv("PILOT_WORK_NUMBER", "96");
  vi.stubEnv("PILOT_COMPLETION_COMMENT_ID", "14");
  vi.stubEnv("PILOT_COMPLETION_PROJECTS_TOKEN", "project-fixture");
  const record = comment(
    14,
    96,
    JSON.stringify({
      ...candidate,
      kind: "work-completion",
      mergeSha,
      scopeConcluded: true,
      reviewsAccepted: true,
      validationSufficient: true,
      durableOwnersSynchronized: true,
      workingDecisionsResolved: true,
      postMergeObligationsSatisfied: true,
    }),
  );
  const state = {
    status: "Validating",
    closed: false,
    release: true,
    closeFails: false,
    item: "PVTI",
  };
  const writes: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/graphql") {
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer project-fixture",
      );
      const { query, variables } = JSON.parse(String(init?.body)) as {
        query: string;
        variables: unknown;
      };
      if (query.includes("updateProjectV2ItemFieldValue")) {
        expect(variables).toEqual({
          project: "PVT",
          item: "PVTI",
          field: "FIELD",
          done: "done",
        });
        writes.push("done");
        state.status = "Done";
        return Response.json({
          data: {
            updateProjectV2ItemFieldValue: {
              projectV2Item: { id: state.item },
            },
          },
        });
      }
      return Response.json({
        data: {
          user: {
            databaseId: actor.id,
            projectV2: {
              id: "PVT",
              closed: false,
              field: { id: "FIELD", options: [{ id: "done", name: "Done" }] },
            },
          },
          repository: {
            databaseId: repo.id,
            issue: {
              number: 96,
              parent: null,
              projectItems: {
                nodes: [
                  {
                    id: "PVTI",
                    project: { id: "PVT" },
                    status: { name: state.status },
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          },
        },
      });
    }
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer repository-fixture",
    );
    const path = url.pathname.slice("/repos/Oxelio/architecture-web".length);
    switch (path) {
      case "/issues/comments/14":
        return Response.json(record);
      case "/pulls/98":
        return Response.json({
          number: 98,
          state: "closed",
          merged: true,
          body: "Refs #96",
          merge_commit_sha: mergeSha,
          head: { repo, sha: candidate.headSha },
          base: { repo, ref: "main" },
        });
      case `/commits/${mergeSha}`:
        return Response.json({
          sha: mergeSha,
          parents: [{ sha: candidate.baseSha }],
        });
      case `/compare/${mergeSha}...main`:
        return Response.json({
          status: "ahead",
          merge_base_commit: { sha: mergeSha },
        });
      case "/issues/96/events":
        return Response.json([]);
      case "/issues/96":
        if (init?.method === "PATCH") {
          expect(state.status).toBe("Done");
          expect(JSON.parse(String(init.body))).toEqual({
            state: "closed",
            state_reason: "completed",
          });
          writes.push("close");
          if (state.closeFails) {
            return new Response(null, { status: 503 });
          }
          state.closed = true;
        }
        return Response.json({
          number: 96,
          repository_url: root,
          state: state.closed ? "closed" : "open",
          state_reason: state.closed ? "completed" : null,
        });
      case "/actions/workflows/delivery-automation-validation.yml/runs":
      case "/actions/workflows/release.yml/runs":
        expect(url.searchParams.get("head_sha")).toBe(mergeSha);
        return Response.json({
          workflow_runs: [
            {
              head_sha: mergeSha,
              head_branch: "main",
              event: "push",
              status: "completed",
              conclusion:
                path.includes("/release.yml/") && !state.release
                  ? "failure"
                  : "success",
            },
          ],
        });
      default:
        throw new Error(`Unexpected GitHub request ${path}`);
    }
  });
  return { result, state, writes };
}

it("verifies downstream runs and writes Done before closing the scoped Work", async () => {
  const { result, writes, state } = completionFixture();
  await import("./work-completion-pilot.js");
  expect(result()).toMatchObject({ result: { status: "completed" } });
  expect(writes).toEqual(["done", "close"]);
  expect(state.closed).toBe(true);
});

it("waits for source processing without writing either owner", async () => {
  const { result, writes, state } = completionFixture();
  state.release = false;
  await import("./work-completion-pilot.js");
  expect(result()).toMatchObject({
    result: { reason: "DONE_EVIDENCE_INCOMPLETE" },
  });
  expect(writes).toEqual([]);
});

it("recovers a partial closure using a fresh authorized dispatch", async () => {
  const { result, writes, state } = completionFixture(true);
  state.status = "Done";
  await import("./work-completion-pilot.js");
  expect(result()).toMatchObject({ result: { status: "completed" } });
  expect(writes).toEqual(["close"]);
});

it("does not attempt Issue closure after an unverified Project mutation response", async () => {
  const { result, writes, state } = completionFixture();
  state.item = "other";
  await import("./work-completion-pilot.js");
  expect(result()).toMatchObject({ result: { status: "retry" } });
  expect(writes).toEqual(["done"]);
});

it("rejects unauthorized recovery before using credentials", async () => {
  completionFixture(true);
  vi.stubEnv("GITHUB_ACTOR_ID", "2");
  await expect(import("./work-completion-pilot.js")).rejects.toThrow(
    "does not authorize recovery",
  );
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

function issuerFixture(pass = true) {
  const result = workflow("workflow_dispatch", {});
  for (const [key, value] of Object.entries({
    PILOT_PULL_NUMBER: "98",
    PILOT_WORK_NUMBER: "96",
    PILOT_HEAD_SHA: candidate.headSha,
    PILOT_BASE_SHA: candidate.baseSha,
    GITHUB_SHA: candidate.baseSha,
    TRUSTED_WORKFLOW_SHA: candidate.baseSha,
    PILOT_GATE_APP_TOKEN: "checks-only-fixture",
    PILOT_GATE_APP_ID: "5625775",
    PILOT_GATE_INSTALLATION_ID: "178883123",
    GATE_RESULT_B64: Buffer.from(
      JSON.stringify({
        candidate,
        expiresAt: "2099-01-01T00:00:00Z",
        result: {
          pass,
          blockers: pass ? [] : ["WORK_NOT_VALIDATING"],
          grantsMergeAuthority: false,
          impliesDone: false,
        },
      }),
    ).toString("base64"),
  })) {
    vi.stubEnv(key, value);
  }
  const issuer = { id: 5625775 };
  const current = { sha: candidate.baseSha };
  const existing: unknown[] = [];
  const published = vi.fn();
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const authorization = new Headers(init?.headers).get("authorization");
      if (
        String(input).includes("/commits/") &&
        String(input).includes("/check-runs?")
      ) {
        expect(authorization).toBe("Bearer repository-fixture");
        return Response.json({
          total_count: existing.length,
          check_runs: existing,
        });
      }
      switch (String(input).slice(root.length)) {
        case "/pulls/98":
          expect(authorization).toBe("Bearer repository-fixture");
          return Response.json({
            number: 98,
            state: "open",
            draft: false,
            merged: false,
            body: "Refs #96",
            head: { repo, sha: candidate.headSha },
            base: { repo, sha: candidate.baseSha, ref: "main" },
          });
        case "/branches/main":
          expect(authorization).toBe("Bearer repository-fixture");
          return Response.json({ commit: current });
        case "/check-runs":
          expect(authorization).toBe("Bearer checks-only-fixture");
          expect(init?.redirect).toBe("error");
          published(JSON.parse(String(init?.body)));
          return Response.json({
            id: 4,
            html_url: "https://github.com/example/runs/4",
            app: issuer,
          });
        default:
          throw new Error("Unexpected GitHub request");
      }
    });
  return { result, issuer, current, published, fetch, existing };
}

it("publishes the evaluated result with a checks-only token", async () => {
  const { result, published } = issuerFixture();
  await import("./work-evaluated-gate-publish.js");
  expect(result()).toMatchObject({ appId: 5625775, published: { id: 4 } });
  expect(published).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Architecture Web / Work Merge Gate",
      conclusion: "success",
      head_sha: candidate.headSha,
      external_id: `work:96:pr:98:${candidate.headSha}:${candidate.baseSha}`,
    }),
  );
});

it("publishes failure when the evaluated Gate blocks", async () => {
  const { published } = issuerFixture(false);
  await import("./work-evaluated-gate-publish.js");
  expect(published).toHaveBeenCalledWith(
    expect.objectContaining({ conclusion: "failure" }),
  );
});

it("rejects a second publication of the same candidate", async () => {
  const { existing, published } = issuerFixture();
  existing.push({
    app: { id: 5625775 },
    external_id: `work:96:pr:98:${candidate.headSha}:${candidate.baseSha}`,
  });
  await expect(import("./work-evaluated-gate-publish.js")).rejects.toThrow(
    "already been published",
  );
  expect(published).not.toHaveBeenCalled();
});

it("does not treat a check from another App as verified", async () => {
  const { issuer } = issuerFixture();
  issuer.id = 8;
  await expect(import("./work-evaluated-gate-publish.js")).rejects.toThrow(
    "invalid response",
  );
});

it("rejects an unexpected installation before calling GitHub", async () => {
  const { fetch } = issuerFixture();
  vi.stubEnv("PILOT_GATE_INSTALLATION_ID", "1");
  await expect(import("./work-evaluated-gate-publish.js")).rejects.toThrow(
    "verified GitHub App installation",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("does not publish for a stale base", async () => {
  const { current, published } = issuerFixture();
  current.sha = mergeSha;
  await expect(import("./work-evaluated-gate-publish.js")).rejects.toThrow(
    "candidate does not match",
  );
  expect(published).not.toHaveBeenCalled();
});

it("rejects the wrong Gate requester before using a token", async () => {
  const { fetch } = issuerFixture();
  vi.stubEnv("GITHUB_ACTOR_ID", "2");
  await expect(import("./work-evaluated-gate-publish.js")).rejects.toThrow(
    "authenticated maintainer",
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("evaluates only the current authorized Work and returns the shared Gate decision", async () => {
  const { result } = issuerFixture();
  vi.stubEnv("DELIVERY_OBSERVATION_PROJECTS_TOKEN", "project-fixture");
  vi.stubEnv(
    "DELIVERY_EVALUATED_GATE_EVIDENCE",
    JSON.stringify({
      ...candidate,
      actorId: actor.id,
      repositoryId: repo.id,
      expiresAt: "2099-01-01T00:00:00Z",
    }),
  );
  evaluateGate.mockResolvedValue({
    pass: true,
    blockers: [],
    grantsMergeAuthority: false,
    impliesDone: false,
  });
  await import("./work-evaluated-gate.js");
  expect(evaluateGate).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: "PVT",
      repositoryToken: "repository-fixture",
      projectsToken: "project-fixture",
    }),
    candidate,
  );
  expect(result()).toMatchObject({ candidate, result: { pass: true } });
});

it("rejects a missing or mismatched protected Gate authorization", async () => {
  issuerFixture();
  vi.stubEnv("DELIVERY_EVALUATED_GATE_EVIDENCE", "{}");
  await expect(import("./work-evaluated-gate.js")).rejects.toThrow(
    "EVALUATED_GATE_NOT_AUTHORIZED",
  );
});
