import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyControllerInstallation } from "../github/controller-installation.js";
import { verifyControllerJournalEnforcement } from "../github/controller-journal-probe.js";
import {
  githubRepositoryRequest,
  requireTrustedMain,
} from "./work-pilot-support.js";

vi.mock("../github/controller-installation.js");
vi.mock("../github/controller-journal-probe.js");
vi.mock("./work-pilot-support.js");

const mainSha = "a".repeat(40);
const parentSha = "b".repeat(40);
const workflowRef =
  "Oxelio/architecture-web/.github/workflows/delivery-work-controller-identity.yml@refs/heads/main";
const installation = {
  repositoryId: 1336937640,
  installationId: 182503016,
  botId: 52,
};
const proof = {
  ref: "refs/tags/delivery-control/disabled-probe-42",
  sha: mainSha,
  ordinaryCreation: "denied",
  controllerCreation: "allowed",
  controllerUpdate: "denied",
  controllerDeletion: "denied",
} as const;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  for (const [name, value] of Object.entries({
    GITHUB_ACTOR_ID: "83680141",
    GITHUB_WORKFLOW_REF: workflowRef,
    GITHUB_RUN_ID: "42",
    TRUSTED_WORKFLOW_SHA: mainSha,
    GITHUB_TOKEN: "workflow",
    CONTROLLER_INSTALLATION_TOKEN: "controller",
    CONTROLLER_APP_SLUG: "architecture-web-work-controller",
    CONTROLLER_INSTALLATION_ID: "182503016",
    EXPECTED_CONTROLLER_INSTALLATION_ID: "182503016",
  })) {
    vi.stubEnv(name, value);
  }
  vi.mocked(githubRepositoryRequest)
    .mockResolvedValueOnce({ commit: { sha: mainSha } })
    .mockResolvedValueOnce({ sha: mainSha, parents: [{ sha: parentSha }] });
  vi.mocked(verifyControllerInstallation).mockResolvedValue(installation);
  vi.mocked(verifyControllerJournalEnforcement).mockResolvedValue(proof);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("protected controller journal probe entry point", () => {
  it("binds the exact actor, workflow revision, run and App before reporting success", async () => {
    await import("./controller-journal-probe.js");
    expect(requireTrustedMain).toHaveBeenCalledExactlyOnceWith(
      "workflow_dispatch",
    );
    expect(githubRepositoryRequest).toHaveBeenNthCalledWith(
      1,
      "/branches/main",
    );
    expect(githubRepositoryRequest).toHaveBeenNthCalledWith(
      2,
      `/commits/${mainSha}`,
    );
    expect(verifyControllerInstallation).toHaveBeenCalledExactlyOnceWith({
      token: "controller",
      appSlug: "architecture-web-work-controller",
      expectedAppSlug: "architecture-web-work-controller",
      installationId: installation.installationId,
      expectedInstallationId: installation.installationId,
    });
    expect(verifyControllerJournalEnforcement).toHaveBeenCalledExactlyOnceWith({
      runId: 42,
      mainSha,
      parentSha,
      workflowToken: "workflow",
      controllerToken: "controller",
    });
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining(proof.ref),
    );
  });

  it.each([
    ["GITHUB_ACTOR_ID", "52"],
    ["GITHUB_WORKFLOW_REF", workflowRef.replace("heads/main", "heads/other")],
  ])("rejects a mismatched %s before contacting GitHub", async (key, value) => {
    vi.stubEnv(key, value);
    await expect(import("./controller-journal-probe.js")).rejects.toThrow(
      "direct maintainer",
    );
    expect(githubRepositoryRequest).not.toHaveBeenCalled();
    expect(verifyControllerJournalEnforcement).not.toHaveBeenCalled();
  });

  it("rejects a stale workflow SHA before reading the parent", async () => {
    vi.mocked(githubRepositoryRequest)
      .mockReset()
      .mockResolvedValue({ commit: { sha: parentSha } });
    await expect(import("./controller-journal-probe.js")).rejects.toThrow(
      "current main revision",
    );
    expect(githubRepositoryRequest).toHaveBeenCalledTimes(1);
    expect(verifyControllerJournalEnforcement).not.toHaveBeenCalled();
  });

  it.each([
    { sha: parentSha, parents: [{ sha: parentSha }] },
    { sha: mainSha, parents: [] },
  ])(
    "rejects inconsistent commit or parent evidence before verifying the App",
    async (commit) => {
      vi.mocked(githubRepositoryRequest)
        .mockReset()
        .mockResolvedValueOnce({ commit: { sha: mainSha } })
        .mockResolvedValueOnce(commit);
      await expect(import("./controller-journal-probe.js")).rejects.toThrow(
        "revision's parent",
      );
      expect(verifyControllerInstallation).not.toHaveBeenCalled();
      expect(verifyControllerJournalEnforcement).not.toHaveBeenCalled();
    },
  );

  it("refuses to create a ref when App identity verification fails", async () => {
    vi.mocked(verifyControllerInstallation).mockResolvedValue(null);
    await expect(import("./controller-journal-probe.js")).rejects.toThrow(
      "installation could not be verified",
    );
    expect(verifyControllerJournalEnforcement).not.toHaveBeenCalled();
  });
});
