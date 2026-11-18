import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type {
  matchesStandingControllerBoundary,
  StandingControllerBoundary,
} from "../github/standing-controller-boundary.js";
import {
  protectedProjectId,
  readActionsOidcToken,
  readProtectedRuntime,
  requireProtectedDispatch,
} from "./protected-runtime.js";

const mock = vi.hoisted(() => ({
  request: vi.fn(),
  comment: vi.fn(),
  control: vi.fn(),
  installation: vi.fn(),
  inventory: vi.fn(),
  owner: vi.fn(),
  manifest: vi.fn(),
  boundary: vi.fn(),
  revoked: vi.fn(),
  rules: vi.fn(),
  project: vi.fn(),
  writer: vi.fn(),
  worker: vi.fn(),
  output: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock(import("./work-pilot-support.js"), async (original) => ({
  ...(await original()),
  githubRepositoryRequest: mock.request,
  readDirectMaintainerRecord: mock.comment,
}));
vi.mock(import("./gate-publication-support.js"), async (original) => ({
  ...(await original()),
  readActivationManifest: mock.manifest,
  writeJson: mock.output,
}));
vi.mock(import("../config/activation-context.js"), () => ({
  resolveActivationContext: mock.owner,
}));
vi.mock(import("../github/authoring-control-revision.js"), () => ({
  createAuthoringControlVerifier: () => mock.control,
}));
vi.mock(import("../github/controller-installation.js"), () => ({
  verifyControllerInstallation: mock.installation,
}));
vi.mock(import("../github/github-project-inventory.js"), () => ({
  readGitHubInventory: mock.inventory,
}));
vi.mock(import("../github/standing-controller-boundary.js"), () => ({
  matchesStandingControllerBoundary: (
    value: StandingControllerBoundary | null,
    expected: Parameters<typeof matchesStandingControllerBoundary>[1],
    use: Parameters<typeof matchesStandingControllerBoundary>[2],
  ): value is StandingControllerBoundary =>
    mock.boundary(value, expected, use) === true,
}));
vi.mock(import("../github/standing-delegation-revocation.js"), () => ({
  isStandingDelegationRevoked: mock.revoked,
}));
vi.mock(import("../github/work-merge-publisher.js"), () => ({
  verifyStandingJournalRules: mock.rules,
}));
vi.mock(import("../github/github-operational-state.js"), () => ({
  readProjectWorkItems: mock.project,
}));
vi.mock(import("../github/work-status-writer.js"), () => ({
  createCoordinatedProjectStatusWriter: mock.writer,
}));
vi.mock(import("../github/protected-authoring-worker.js"), () => ({
  createProtectedAuthoringWorker: () => mock.worker,
}));

const sha = "a".repeat(40);
const digest = "b".repeat(64);
const origin = "https://intake.example.test";
const workflowRef =
  "Oxelio/architecture-web/.github/workflows/delivery-authoring.yml@refs/heads/main";
const activation = {
  workState: true,
  dependencies: true,
  workIntegrationPr: true,
};
const boundary = {
  checksInstallationId: 178883123,
  mergeRulesetId: 99,
  journalCreationRulesetId: 100,
  journalImmutabilityRulesetId: 101,
  rulesetObservations: [{ rulesetId: 100 }, { rulesetId: 101 }],
};
const channel = {
  kind: "protected-authoring-channel",
  repositoryId: 1336937640,
  projectNumber: 3,
  workflowPath: ".github/workflows/delivery-authoring.yml",
  intakeOrigin: origin,
  dispatchActorId: 42,
  approvedControlRevision: sha,
  authoringAppId: 55,
  authoringInstallationId: 56,
  authoringBotId: 57,
  expiresAt: "2026-11-18T13:00:00.000Z",
  permissions: [
    {
      actorDigest: digest,
      workNumber: 140,
      kinds: ["edit-work"],
      commandDigests: [],
    },
  ],
};
let previousExitCode: typeof process.exitCode;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  previousExitCode = process.exitCode;
  for (const [key, value] of Object.entries({
    GITHUB_REPOSITORY: "Oxelio/architecture-web",
    GITHUB_REPOSITORY_ID: "1336937640",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: sha,
    GITHUB_WORKFLOW_REF: workflowRef,
    GITHUB_ACTOR_ID: "42",
    GITHUB_TOKEN: "fixture-read",
    TRUSTED_WORKFLOW_SHA: sha,
    DELIVERY_OBSERVATION_PROJECTS_TOKEN: "fixture-project-read",
    CONTROLLER_INSTALLATION_TOKEN: "fixture-controller",
    CONTROLLER_INSTALLATION_ID: "182503016",
    CONTROLLER_APP_SLUG: "architecture-web-work-controller",
    DELIVERY_STANDING_BOUNDARY_COMMENT_ID: "81",
    DELIVERY_STANDING_DELEGATION_COMMENT_ID: "82",
    DELIVERY_AUTHORING_ENABLED: "true",
    DELIVERY_AUTHORING_CHANNEL_COMMENT_ID: "83",
    DELIVERY_AUTHORING_INTAKE_ORIGIN: origin,
    DELIVERY_AUTHORING_TOKEN: "fixture-author",
    DELIVERY_AUTHORING_APP_SLUG: "fixture-author",
    EXPECTED_AUTHORING_APP_SLUG: "fixture-author",
    DELIVERY_AUTHORING_INSTALLATION_ID: "56",
    DELIVERY_PROJECT_STATUS_WRITE_TOKEN: "fixture-project-write",
    DELIVERY_PROJECT_STATUS_FIELD_ID: "fixture-status",
    GATE_INSTALLATION_ID: String(boundary.checksInstallationId),
    GATE_APP_TOKEN: "fixture-gate",
    RUNNER_TEMP: "/fixture",
    AUTHORING_REQUEST_ID: digest,
    AUTHORING_PAYLOAD_DIGEST: digest,
    AUTHORING_PROJECT_CONTEXT: "false",
    DELIVERY_AUTHORING_MAXIMUM_EXCHANGE_BYTES: "2000",
    DELIVERY_AUTHORING_MAXIMUM_HISTORY_REVISIONS: "25",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://pipelines.actions.githubusercontent.com/token?api-version=fixture",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fixture-oidc-request",
  })) {
    vi.stubEnv(key, value);
  }
  mock.control.mockResolvedValue(true);
  mock.owner.mockReturnValue({
    status: "ready",
    project: { id: protectedProjectId },
    activation,
  });
  mock.installation.mockImplementation(
    async ({ installationId }: { installationId: number }) => ({
      botId: installationId === 56 ? channel.authoringBotId : 51,
    }),
  );
  mock.boundary.mockReturnValue(true);
  mock.revoked.mockResolvedValue(false);
  mock.rules.mockResolvedValue(true);
  mock.comment.mockImplementation(async (id: number) =>
    id === 81 ? boundary : channel,
  );
  mock.request.mockImplementation(async (path: string) => {
    if (path === "/branches/main") {
      return { commit: { sha } };
    }
    if (path.includes("/contents/packages/tooling")) {
      return [{ name: "delivery-automation", sha }];
    }
    return [
      { name: ".github", sha },
      { name: "pnpm-lock.yaml", sha },
    ];
  });
  mock.writer.mockReturnValue({});
  mock.worker.mockResolvedValue("recorded");
  mock.project.mockResolvedValue([
    { issueNumber: 140, issueOpen: true, fields: { Status: "Implementing" } },
  ]);
  mock.fetch.mockResolvedValueOnce(
    Response.json({ value: "fixture.oidc.signature" }),
  );
  vi.stubGlobal("fetch", mock.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  process.exitCode = previousExitCode;
});

it("requires a first dispatch from the exact protected workflow", () => {
  expect(() =>
    requireProtectedDispatch("delivery-authoring.yml"),
  ).not.toThrow();
  expect(() => requireProtectedDispatch("replacement.yml")).toThrow(
    "PROTECTED_WORKFLOW_UNVERIFIED",
  );
  vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
  expect(() => requireProtectedDispatch("delivery-authoring.yml")).toThrow(
    "fresh event",
  );
});

it("binds the protected runtime to the active Project, installed Apps and journal protection", async () => {
  const runtime = await readProtectedRuntime(sha);
  expect(runtime).toMatchObject({ actorId: 51, workflowSha: sha });
  await expect(runtime?.verify()).resolves.toBe(true);
  expect(mock.boundary).toHaveBeenCalledWith(
    boundary,
    expect.objectContaining({
      controllerInstallationId: 182503016,
      checksInstallationId: 178883123,
      sources: {
        ".github": sha,
        "pnpm-lock.yaml": sha,
        "packages/tooling/delivery-automation": sha,
      },
    }),
    expect.objectContaining({ mode: "standing" }),
  );
  await expect(runtime?.readStandingRulesetObservation(100)).resolves.toEqual({
    rulesetId: 100,
  });
  await expect(
    runtime?.readStandingRulesetObservation(102),
  ).resolves.toBeNull();
  mock.revoked.mockResolvedValue(true);
  await expect(runtime?.verify()).resolves.toBe(false);
  expect(mock.rules).toHaveBeenCalledOnce();
  mock.comment.mockResolvedValue({ ...boundary, mergeRulesetId: 500 });
  await expect(runtime?.verify()).resolves.toBe(false);
});

it.each(["control revision", "installation", "project", "boundary"])(
  "withholds runtime authority if %s cannot be verified",
  async (cause) => {
    if (cause === "control revision") {
      mock.control.mockResolvedValue(false);
    }
    if (cause === "installation") {
      mock.installation.mockResolvedValue(null);
    }
    if (cause === "project") {
      mock.owner.mockReturnValue({
        status: "ready",
        project: { id: "wrong" },
        activation,
      });
    }
    if (cause === "boundary") {
      mock.boundary.mockReturnValue(false);
    }
    await expect(readProtectedRuntime(sha)).resolves.toBeNull();
  },
);

it("requests an audience-bound token without following redirects and rejects foreign endpoints", async () => {
  await expect(readActionsOidcToken(origin)).resolves.toBe(
    "fixture.oidc.signature",
  );
  expect(mock.fetch.mock.calls[0]?.[0]).toBeInstanceOf(URL);
  expect(String(mock.fetch.mock.calls[0]?.[0])).toContain(
    "audience=https%3A%2F%2Fintake.example.test",
  );
  expect(mock.fetch.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  vi.stubEnv(
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "https://actions.githubusercontent.com.example.test/token",
  );
  await expect(readActionsOidcToken(origin)).rejects.toThrow(
    "ENDPOINT_UNVERIFIED",
  );
  expect(mock.fetch).toHaveBeenCalledOnce();
});

it("rejects a malformed token response", async () => {
  mock.fetch.mockReset().mockResolvedValue(Response.json({ value: "invalid" }));
  await expect(readActionsOidcToken(origin)).rejects.toThrow(
    "TOKEN_UNVERIFIED",
  );
});

it("dispatches exactly the sealed request through the verified worker", async () => {
  await import("./protected-authoring.js");
  expect(mock.worker).toHaveBeenCalledWith(
    expect.objectContaining({
      intakeOrigin: origin,
      workflowSha: sha,
      requestId: digest,
      expectedPayloadDigest: digest,
    }),
  );
  const [dispatch] = mock.worker.mock.calls[0] as [
    { getJobToken: () => Promise<string> },
  ];
  await expect(dispatch.getJobToken()).resolves.toBe("fixture.oidc.signature");
  expect(mock.output).toHaveBeenCalledWith({ status: "recorded" });
});

it("publishes only the approved Project projection and skips the write worker", async () => {
  vi.stubEnv("AUTHORING_PROJECT_CONTEXT", "true");
  mock.fetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
  await import("./protected-authoring.js");
  expect(mock.fetch).toHaveBeenLastCalledWith(
    `${origin}/jobs/project-context`,
    expect.objectContaining({
      method: "POST",
      redirect: "error",
      body: expect.stringContaining('"workNumber":140'),
    }),
  );
  expect(mock.output).toHaveBeenCalledWith({ status: "recorded" });
  expect(mock.worker).not.toHaveBeenCalled();
  expect(mock.installation).not.toHaveBeenCalled();
});

it.each([
  "inactive",
  "wrong actor",
  "wrong origin",
  "unbound installer",
  "missing writer",
])("does not run the authoring worker for %s", async (cause) => {
  if (cause === "inactive") {
    vi.stubEnv("DELIVERY_AUTHORING_ENABLED", "");
  }
  if (cause === "wrong actor") {
    vi.stubEnv("GITHUB_ACTOR_ID", "44");
  }
  if (cause === "wrong origin") {
    vi.stubEnv("DELIVERY_AUTHORING_INTAKE_ORIGIN", "https://wrong.example");
  }
  if (cause === "unbound installer") {
    mock.installation
      .mockResolvedValueOnce({ botId: 51 })
      .mockResolvedValueOnce({ botId: 999 });
  }
  if (cause === "missing writer") {
    mock.writer.mockReturnValue(null);
  }
  await import("./protected-authoring.js");
  expect(mock.output).toHaveBeenCalledWith({
    status: cause === "inactive" ? "inactive" : "denied",
  });
  expect(mock.worker).not.toHaveBeenCalled();
});
