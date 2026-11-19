import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveActivationContext } from "../config/activation-context.js";
import { readStandingDelegation } from "../control/standing-delegation.js";
import {
  readStandingEvidenceWakeup,
  readStandingIntegrationWakeup,
} from "../control/standing-integration-wakeup.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { runStandingWorkIntegration } from "../github/run-standing-work-integration.js";
import {
  githubRepositoryRequest,
  readMaintainerRecord,
} from "./work-pilot-support.js";

vi.mock("node:fs/promises", () => ({ readFile: async () => "{}" }));
vi.mock("./work-pilot-support.js");
vi.mock("./gate-publication-support.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gate-publication-support.js")>()),
  readActivationManifest: vi.fn(async () => ({})),
  writeJson: vi.fn(),
}));
vi.mock("../config/activation-context.js");
vi.mock("../control/standing-delegation.js");
vi.mock("../control/standing-integration-wakeup.js");
vi.mock("../github/controller-installation.js");
vi.mock("../github/github-project-inventory.js");
vi.mock("../github/run-standing-work-integration.js");

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const binding = {
  kind: "standing-work-controller-boundary",
  mode: "standing",
  repositoryId: 1336937640,
  projectId: "PVT-fixture",
  controllerInstallationId: 182503016,
  checksInstallationId: 178883123,
  sources: {
    ".github": "c".repeat(40),
    "pnpm-lock.yaml": "d".repeat(40),
    "packages/tooling/delivery-automation": "e".repeat(40),
  },
  freshnessPolicy: "final-observation",
  validationRef: "https://github.com/Oxelio/architecture-web/actions/runs/123",
  journalCreationRulesetId: 101,
  journalImmutabilityRulesetId: 102,
  mergeRulesetId: 103,
  rulesetObservations: [{ rulesetId: 101 }],
  evidenceAuthority: { "code-review": [{ authorId: 83, appId: 91 }] },
};

const runner = vi.mocked(runStandingWorkIntegration);
const request = vi.mocked(githubRepositoryRequest);
const proof = vi.mocked(readMaintainerRecord);

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({
    GITHUB_EVENT_NAME: "workflow_run",
    GITHUB_EVENT_PATH: "fixture.json",
    GITHUB_WORKFLOW_REF:
      "Oxelio/architecture-web/.github/workflows/delivery-work-integration-request.yml@refs/heads/main",
    TRUSTED_WORKFLOW_SHA: candidate.baseSha,
    GITHUB_REPOSITORY: "Oxelio/architecture-web",
    GITHUB_REPOSITORY_ID: "1336937640",
    GITHUB_REF: "refs/heads/main",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_TOKEN: "repository-token",
    CONTROLLER_INSTALLATION_TOKEN: "controller-token",
    CONTROLLER_APP_SLUG: "architecture-web-work-controller",
    CONTROLLER_INSTALLATION_ID: "182503016",
    EXPECTED_CONTROLLER_INSTALLATION_ID: "182503016",
    GATE_APP_TOKEN: "checks-token",
    GATE_INSTALLATION_ID: "178883123",
    DELIVERY_OBSERVATION_PROJECTS_TOKEN: "project-reader",
    DELIVERY_STANDING_EXECUTION_ENABLED: "true",
    DELIVERY_STANDING_VALIDATION_COMMENT_ID: "",
    DELIVERY_STANDING_DELEGATION_COMMENT_ID: "91",
    DELIVERY_STANDING_REQUESTS_ENABLED: "",
    DELIVERY_STANDING_WAKEUP_ONLY: "",
  })) {
    vi.stubEnv(name, value);
  }
  vi.mocked(readStandingIntegrationWakeup).mockResolvedValue({
    status: "selected",
    candidate,
    validationRunId: 42,
  });
  vi.mocked(verifyControllerInstallation).mockResolvedValue({
    repositoryId: 1336937640,
    installationId: 182503016,
    botId: 52,
  });
  vi.mocked(resolveActivationContext).mockReturnValue({
    status: "ready",
    project: { id: "PVT-fixture" },
    activation: {},
  } as ReturnType<typeof resolveActivationContext>);
  vi.mocked(readGitHubInventory).mockResolvedValue(
    {} as Awaited<ReturnType<typeof readGitHubInventory>>,
  );
  vi.mocked(readStandingDelegation).mockResolvedValue({
    repositoryId: 1336937640,
    controllerBotId: 52,
    workflowSha: candidate.baseSha,
    gatePublication: true,
    nativeSquash: true,
    expiresAt: "2099-01-01T00:00:00Z",
  });
  proof.mockResolvedValue(binding);
  request.mockImplementation(async (path) => {
    if (path.startsWith("/contents/packages/tooling?")) {
      return [
        {
          name: "delivery-automation",
          sha: binding.sources["packages/tooling/delivery-automation"],
        },
      ];
    }
    if (path.startsWith("/contents?")) {
      return [
        { name: ".github", sha: binding.sources[".github"] },
        { name: "pnpm-lock.yaml", sha: binding.sources["pnpm-lock.yaml"] },
      ];
    }
    if (path === "/branches/main") {
      return { commit: { sha: candidate.baseSha } };
    }
    throw new Error(`Unexpected request ${path}`);
  });
  runner.mockResolvedValue({ status: "released", checkId: 17 });
});

afterEach(() => vi.unstubAllEnvs());

describe("protected controller entry point", () => {
  it("does nothing when neither execution mode is configured", async () => {
    vi.stubEnv("DELIVERY_STANDING_EXECUTION_ENABLED", "");
    await import("./work-integration-request.js");
    expect(readStandingIntegrationWakeup).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it("does not run the privileged controller for a read-only evidence intake", async () => {
    vi.stubEnv("GITHUB_EVENT_NAME", "issue_comment");
    vi.stubEnv("DELIVERY_STANDING_WAKEUP_ONLY", "true");
    vi.mocked(readStandingEvidenceWakeup).mockResolvedValue({
      status: "selected",
      candidate,
    });
    await import("./work-integration-request.js");
    expect(readStandingEvidenceWakeup).toHaveBeenCalledOnce();
    expect(runner).not.toHaveBeenCalled();
    expect(verifyControllerInstallation).not.toHaveBeenCalled();
  });

  it.each(["wrong-workflow", "missing-proof", "shared-token"])(
    "rejects %s before execution",
    async (fault) => {
      if (fault === "wrong-workflow") {
        vi.stubEnv("GITHUB_WORKFLOW_REF", "other");
      }
      if (fault === "missing-proof") {
        proof.mockResolvedValue(null);
      }
      if (fault === "shared-token") {
        vi.stubEnv("GATE_APP_TOKEN", "controller-token");
      }
      await import("./work-integration-request.js");
      expect(runner).not.toHaveBeenCalled();
    },
  );

  it("binds the controller to exact live authority, source trees and distinct credentials", async () => {
    await import("./work-integration-request.js");
    expect(runner).toHaveBeenCalledOnce();
    const input = runner.mock.calls[0]?.[0];
    if (!input) {
      throw new Error("Expected controller invocation");
    }

    expect(input.candidate).toEqual(candidate);
    expect(input.scope.checksToken).toBe("checks-token");
    expect(input.scope.publisher.mergeToken).toBe("controller-token");
    expect(input.scope.publisher.projectsToken).toBe("project-reader");
    expect(input.journalRules).toEqual({
      creationRulesetId: 101,
      immutabilityRulesetId: 102,
      controllerAppId: 5781545,
    });
    expect(await input.readEvidenceAuthority()).toEqual(
      binding.evidenceAuthority,
    );
    expect(
      await input.scope.publisher.readStandingRulesetObservation?.(101),
    ).toEqual({ rulesetId: 101 });
    expect(await input.readDelegation()).toMatchObject({
      controllerBotId: 52,
      decisionCommentId: 91,
    });
    const effect = vi.fn(async () => "performed");
    expect(await input.scope.withinFinalReleaseAuthority?.(effect)).toBe(
      "performed",
    );
    proof.mockResolvedValue(null);
    expect(await input.scope.withinFinalReleaseAuthority?.(effect)).toBeNull();
    expect(await input.authorizeRecovery(candidate)).toBe(false);
    expect(effect).toHaveBeenCalledOnce();
  });
});
