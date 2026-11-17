import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyControllerInstallation } from "../github/controller-installation.js";
import { recordStandingDelegationRevocation } from "../github/standing-delegation-revocation.js";
import { verifyStandingJournalRules } from "../github/work-merge-publisher.js";
import {
  githubRepositoryRequest,
  readDirectMaintainerRecord,
} from "./work-pilot-support.js";

vi.mock("./work-pilot-support.js");
vi.mock("../github/controller-installation.js");
vi.mock("../github/standing-delegation-revocation.js");
vi.mock("../github/work-merge-publisher.js");

const sha = "a".repeat(40);
const command = {
  kind: "revoke-standing-work-integration",
  repositoryId: 1336937640,
  delegationCommentId: 91,
};

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  for (const [name, value] of Object.entries({
    GITHUB_ACTOR_ID: "83680141",
    TRUSTED_WORKFLOW_SHA: sha,
    GITHUB_WORKFLOW_REF:
      "Oxelio/architecture-web/.github/workflows/delivery-work-controller-identity.yml@refs/heads/main",
    REVOCATION_COMMENT_ID: "92",
    DELIVERY_STANDING_DELEGATION_COMMENT_ID: "91",
    GITHUB_TOKEN: "reader",
    CONTROLLER_INSTALLATION_TOKEN: "controller",
    CONTROLLER_APP_SLUG: "architecture-web-work-controller",
    CONTROLLER_INSTALLATION_ID: "182503016",
    EXPECTED_CONTROLLER_INSTALLATION_ID: "182503016",
    DELIVERY_CONTROLLER_CREATION_RULESET_ID: "2",
    DELIVERY_CONTROLLER_IMMUTABILITY_RULESET_ID: "3",
  })) {
    vi.stubEnv(name, value);
  }
  vi.mocked(githubRepositoryRequest).mockResolvedValue({ commit: { sha } });
  vi.mocked(readDirectMaintainerRecord).mockResolvedValue(command);
  vi.mocked(verifyControllerInstallation).mockResolvedValue({
    repositoryId: 1336937640,
    installationId: 182503016,
    botId: 52,
  });
  vi.mocked(verifyStandingJournalRules).mockResolvedValue(true);
  vi.mocked(recordStandingDelegationRevocation).mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("protected ordinary revocation entry point", () => {
  it("uses the controller token only after checking exact maintainer authority and journal protections", async () => {
    await import("./revoke-standing-delegation.js");
    expect(readDirectMaintainerRecord).toHaveBeenCalledWith(92, 115);
    expect(verifyStandingJournalRules).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryToken: "reader" }),
      {
        creationRulesetId: 2,
        immutabilityRulesetId: 3,
        controllerAppId: 5781545,
      },
    );
    expect(recordStandingDelegationRevocation).toHaveBeenCalledExactlyOnceWith({
      delegationCommentId: 91,
      repositoryToken: "controller",
      workflowSha: sha,
    });
  });

  it("refuses a legitimate-looking command aimed at another delegation", async () => {
    vi.mocked(readDirectMaintainerRecord).mockResolvedValue({
      ...command,
      delegationCommentId: 90,
    });
    await expect(import("./revoke-standing-delegation.js")).rejects.toThrow(
      "does not match the configured delegation",
    );
    expect(recordStandingDelegationRevocation).not.toHaveBeenCalled();
  });

  it("refuses the operation after rule protection drift", async () => {
    vi.mocked(verifyStandingJournalRules).mockResolvedValue(false);
    await expect(import("./revoke-standing-delegation.js")).rejects.toThrow(
      "journal protection is not verified",
    );
    expect(recordStandingDelegationRevocation).not.toHaveBeenCalled();
  });

  it("does not report revocation without positive durable evidence", async () => {
    vi.mocked(recordStandingDelegationRevocation).mockResolvedValue(false);
    await expect(import("./revoke-standing-delegation.js")).rejects.toThrow(
      "Standing revocation not confirmed",
    );
  });
});
