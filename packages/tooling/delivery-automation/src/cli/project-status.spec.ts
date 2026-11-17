import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveActivationContext } from "../config/activation-context.js";
import { verifyControllerInstallation } from "../github/controller-installation.js";
import { readGitHubInventory } from "../github/github-project-inventory.js";
import { canRecordWorkCompletion } from "../github/github-work-reservation-journal.js";
import { runCoordinatedStatusWrite } from "../github/run-coordinated-status-write.js";
import { isStandingDelegationRevoked } from "../github/standing-delegation-revocation.js";
import { verifyStandingJournalRules } from "../github/work-merge-publisher.js";
import { writeJson } from "./gate-publication-support.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
  readMaintainerRecord,
} from "./work-pilot-support.js";

vi.mock("./work-pilot-support.js");
vi.mock("./gate-publication-support.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gate-publication-support.js")>()),
  readActivationManifest: vi.fn(async () => ({})),
  writeJson: vi.fn(),
}));
vi.mock("../config/activation-context.js");
vi.mock("../github/controller-installation.js");
vi.mock("../github/github-project-inventory.js");
vi.mock("../github/github-work-reservation-journal.js");
vi.mock("../github/run-coordinated-status-write.js");
vi.mock("../github/standing-delegation-revocation.js");
vi.mock("../github/work-merge-publisher.js");

const head = "a".repeat(40);
const workflow = ".github/workflows/delivery-project-status.yml";
const policy = {
  kind: "work-status-channel",
  mode: "standing",
  repositoryId: 1336937640,
  projectNumber: 3,
  workflowPath: workflow,
  actorId: 42,
  appId: 43,
  expiresAt: "2099-01-01T00:00:00Z",
  transitions: [
    {
      from: "Preparing",
      to: "Ready",
      requirements: [{ kind: "readiness", actorId: 44, appId: 45 }],
    },
  ],
};
const proofs = {
  kind: "standing-work-controller-boundary",
  mode: "standing",
  repositoryId: 1336937640,
  projectId: "PVT-test",
  controllerInstallationId: 182503016,
  checksInstallationId: 178883123,
  sources: {
    ".github": "c".repeat(40),
    "pnpm-lock.yaml": "d".repeat(40),
    "packages/tooling/delivery-automation": "e".repeat(40),
  },
  validatedWriters: [
    "project-state",
    "tasks-dependencies",
    "review-decision-records",
    "pr-head-base",
    "gate-issuer",
    "journal-refs",
    "delegation",
  ],
  validationRef: "https://github.com/Oxelio/architecture-web/actions/runs/64",
  journalCreationRulesetId: 101,
  journalImmutabilityRulesetId: 102,
  mergeRulesetId: 103,
  rulesetObservations: [],
  evidenceAuthority: {},
};

const issueUrl =
  "https://api.github.com/repos/Oxelio/architecture-web/issues/140";
const date = "2026-11-17T08:49:00Z";
const command = {
  kind: "record-work-status",
  repositoryId: 1336937640,
  projectNumber: 3,
  workNumber: 140,
  from: "Preparing",
  to: "Ready",
  statusUpdatedAt: "2026-11-17T08:48:00Z",
  evidenceCommentIds: [84],
};
const commandComment = {
  id: 83,
  issue_url: issueUrl,
  body: JSON.stringify(command),
  created_at: date,
  updated_at: date,
  user: { id: 42, type: "User" },
  performed_via_github_app: { id: 43 },
};
const evidenceComment = {
  ...commandComment,
  id: 84,
  user: { id: 44, type: "User" },
  performed_via_github_app: { id: 45 },
  body: JSON.stringify({
    kind: "readiness",
    decision: "accepted",
    workNumber: 140,
    from: "Preparing",
    to: "Ready",
    statusUpdatedAt: command.statusUpdatedAt,
  }),
};
const request = vi.mocked(githubRepositoryRequest);
const runner = vi.mocked(runCoordinatedStatusWrite);

function responses(path: string): unknown {
  if (path === "/issues/comments/83") {
    return commandComment;
  }
  if (path === "/issues/comments/84") {
    return evidenceComment;
  }
  if (path === "/branches/main") {
    return { commit: { sha: head } };
  }
  if (path.startsWith("/contents/packages/tooling?")) {
    return [
      {
        name: "delivery-automation",
        sha: proofs.sources["packages/tooling/delivery-automation"],
      },
    ];
  }
  if (path.startsWith("/contents?")) {
    return [
      { name: ".github", sha: proofs.sources[".github"] },
      { name: "pnpm-lock.yaml", sha: proofs.sources["pnpm-lock.yaml"] },
    ];
  }
  throw new Error(`Unexpected request ${path}`);
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  for (const [name, value] of Object.entries({
    GITHUB_EVENT_NAME: "issue_comment",
    GITHUB_WORKFLOW_REF: `Oxelio/architecture-web/${workflow}@refs/heads/main`,
    GITHUB_ACTOR_ID: "42",
    GITHUB_TOKEN: "repository-reader",
    TRUSTED_WORKFLOW_SHA: head,
    DELIVERY_PROJECT_STATUS_COMMANDS_ENABLED: "true",
    DELIVERY_PROJECT_STATUS_CHANNEL_COMMENT_ID: "81",
    DELIVERY_STANDING_DELEGATION_COMMENT_ID: "91",
    DELIVERY_STANDING_EXECUTION_ENABLED: "true",
    STATUS_COMMAND_WORK_NUMBER: "140",
    STATUS_COMMAND_COMMENT_ID: "83",
    STATUS_COMMAND_INTAKE_ONLY: "true",
    CONTROLLER_INSTALLATION_TOKEN: "controller-token",
    CONTROLLER_APP_SLUG: "architecture-web-work-controller",
    CONTROLLER_INSTALLATION_ID: "182503016",
    EXPECTED_CONTROLLER_INSTALLATION_ID: "182503016",
    DELIVERY_OBSERVATION_PROJECTS_TOKEN: "project-reader",
    DELIVERY_PROJECT_STATUS_WRITE_TOKEN: "project-writer",
  })) {
    vi.stubEnv(name, value);
  }
  request.mockImplementation(async (path) => responses(path));
  vi.mocked(readDirectMaintainerRecord).mockImplementation(async (id) =>
    id === 81 ? policy : null,
  );
  vi.mocked(readMaintainerRecord).mockResolvedValue(proofs);
  vi.mocked(isStandingDelegationRevoked).mockResolvedValue(false);
  vi.mocked(verifyStandingJournalRules).mockResolvedValue(true);
  vi.mocked(verifyControllerInstallation).mockResolvedValue({
    repositoryId: 1336937640,
    installationId: 182503016,
    botId: 52,
  });
  vi.mocked(resolveActivationContext).mockReturnValue({
    status: "ready",
    project: { id: proofs.projectId },
    activation: { workState: true, dependencies: true },
  } as ReturnType<typeof resolveActivationContext>);
  vi.mocked(readGitHubInventory).mockResolvedValue(
    {} as Awaited<ReturnType<typeof readGitHubInventory>>,
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.exitCode = undefined;
});

describe("protected Project Status entrypoint", () => {
  it("does nothing if the switch is absent and does not load credentials", async () => {
    vi.stubEnv("DELIVERY_PROJECT_STATUS_COMMANDS_ENABLED", "");
    await import("./project-status.js");
    expect(writeJson).toHaveBeenCalledWith({ status: "inactive" });
    expect(request).not.toHaveBeenCalled();
  });

  it("authenticates an immutable command and readiness evidence in read-only intake", async () => {
    await import("./project-status.js");
    expect(writeJson).toHaveBeenCalledWith({ status: "eligible" });
    expect(verifyControllerInstallation).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it.each(["edited", "unattributed", "revoked"] as const)(
    "does not queue a privileged job when evidence is %s",
    async (reason) => {
      if (reason === "edited") {
        request.mockImplementation(async (path) =>
          path === "/issues/comments/84"
            ? { ...evidenceComment, updated_at: "2026-11-17T08:49:01Z" }
            : responses(path),
        );
      } else if (reason === "unattributed") {
        request.mockImplementation(async (path) =>
          path === "/issues/comments/84"
            ? { ...evidenceComment, performed_via_github_app: undefined }
            : responses(path),
        );
      } else {
        vi.mocked(isStandingDelegationRevoked).mockResolvedValue(true);
      }
      await import("./project-status.js");
      expect(writeJson).toHaveBeenCalledWith({ status: "denied" });
      expect(runner).not.toHaveBeenCalled();
    },
  );

  it.each(["stale", "different epoch"] as const)(
    "rejects an otherwise authorized Readiness record from a %s",
    async (reason) => {
      const changed =
        reason === "stale"
          ? {
              ...evidenceComment,
              created_at: "2026-11-17T08:47:00Z",
              updated_at: "2026-11-17T08:47:00Z",
            }
          : {
              ...evidenceComment,
              body: JSON.stringify({
                ...JSON.parse(evidenceComment.body),
                statusUpdatedAt: "2026-11-17T08:47:00Z",
              }),
            };
      request.mockImplementation(async (path) =>
        path === "/issues/comments/84" ? changed : responses(path),
      );
      await import("./project-status.js");
      expect(writeJson).toHaveBeenCalledWith({ status: "denied" });
      expect(runner).not.toHaveBeenCalled();
    },
  );

  it("binds the protected recorder to the expected credentials, boundary and reservation guard", async () => {
    vi.stubEnv("STATUS_COMMAND_INTAKE_ONLY", "");
    runner.mockImplementation(async (input) => {
      expect(await input.readAuthorization()).toEqual({
        command,
        authorityId: 81,
      });
      expect(await input.verifyBoundary()).toBe(true);
      expect(input.controllerToken).toBe("controller-token");
      expect(await input.readRecoveryAuthorization(81)).toBeNull();
      return "recorded";
    });
    await import("./project-status.js");
    expect(writeJson).toHaveBeenCalledWith({ status: "recorded" });
    expect(verifyStandingJournalRules).toHaveBeenCalledWith(expect.anything(), {
      creationRulesetId: 101,
      immutabilityRulesetId: 102,
      controllerAppId: 5781545,
    });
    expect(canRecordWorkCompletion).not.toHaveBeenCalled();
  });

  it("uses separate direct authority to request recovery without ordinary channel authority", async () => {
    vi.stubEnv("GITHUB_EVENT_NAME", "workflow_dispatch");
    vi.stubEnv("STATUS_RECOVERY_COMMENT_ID", "85");
    vi.stubEnv("STATUS_COMMAND_INTAKE_ONLY", "");
    vi.mocked(isStandingDelegationRevoked).mockResolvedValue(true);
    vi.mocked(readDirectMaintainerRecord).mockImplementation(async (id) =>
      id === 81
        ? policy
        : id === 85
          ? {
              kind: "recover-project-status",
              repositoryId: 1336937640,
              projectNumber: 3,
              workNumber: 140,
              commentId: 83,
              expiresAt: "2099-01-01T00:00:00Z",
            }
          : null,
    );
    runner.mockImplementation(async (input) => {
      expect(input.recoveryOnly).toBe(true);
      expect(await input.readAuthorization()).toBeNull();
      expect(await input.readRecoveryAuthorization(81)).toEqual({
        command,
        authorityId: 81,
      });
      return "reconciled";
    });
    await import("./project-status.js");
    expect(writeJson).toHaveBeenCalledWith({ status: "reconciled" });
  });
});
