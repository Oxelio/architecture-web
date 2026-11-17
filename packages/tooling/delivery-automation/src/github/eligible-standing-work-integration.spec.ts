import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeEligibleStandingWorkIntegration } from "./eligible-standing-work-integration.js";
import { executeReservedGitHubWorkIntegration } from "./reserved-work-integration.js";
import { verifyStandingWorkEligibility } from "./standing-work-eligibility.js";
import { readAcceptedStandingImpact } from "./work-merge-publisher.js";

vi.mock("./reserved-work-integration.js");
vi.mock("./standing-work-eligibility.js");
vi.mock("./work-merge-publisher.js");

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const publisher = {
  repository: "Oxelio/architecture-web",
  projectId: "PVT-fixture",
  projectsToken: "project-reader",
  repositoryToken: "repo-reader",
};
const fixture = {
  candidate,
  operation: "release-check",
  standingEnabled: true,
  eligibilityReader: publisher,
  scope: { publisher },
  authorize: async () => true,
} as unknown as Parameters<typeof executeEligibleStandingWorkIntegration>[0];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(executeReservedGitHubWorkIntegration).mockImplementation(
    async ({ candidate, operation, authorize }) => ({
      status: (await authorize({ candidate, operation }))
        ? "deferred"
        : "denied",
    }),
  );
});

describe("standing publication eligibility boundary", () => {
  it("never touches the journal while inactive or with mismatched Project credentials", async () => {
    await expect(
      executeEligibleStandingWorkIntegration({
        ...fixture,
        standingEnabled: false,
      }),
    ).resolves.toEqual({ status: "inactive" });
    await expect(
      executeEligibleStandingWorkIntegration({
        ...fixture,
        eligibilityReader: {
          ...fixture.eligibilityReader,
          projectsToken: "other",
        },
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(executeReservedGitHubWorkIntegration).not.toHaveBeenCalled();
  });

  it("requires accepted live impact and candidate-specific authority for each effect", async () => {
    vi.mocked(verifyStandingWorkEligibility).mockImplementation(
      async ({ reader, candidate: live, readAcceptedImpact }) => {
        expect(reader.projectsToken).toBe("project-reader");
        expect(live).toEqual(candidate);
        const impact = await readAcceptedImpact(live);
        return impact?.disposition === "ordinary";
      },
    );
    vi.mocked(readAcceptedStandingImpact)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        candidate,
        factsDigest: "d".repeat(64),
        disposition: "ordinary",
      });
    await expect(
      executeEligibleStandingWorkIntegration(fixture),
    ).resolves.toEqual({ status: "denied" });
    await expect(
      executeEligibleStandingWorkIntegration(fixture),
    ).resolves.toEqual({ status: "deferred" });
    await expect(
      executeEligibleStandingWorkIntegration({
        ...fixture,
        authorize: async () => false,
      }),
    ).resolves.toEqual({ status: "denied" });
    expect(readAcceptedStandingImpact).toHaveBeenCalledTimes(2);
  });

  it("permits an authorized recovery independently of current publication eligibility", async () => {
    await expect(
      executeEligibleStandingWorkIntegration({
        ...fixture,
        operation: "resolve",
        standingEnabled: false,
      }),
    ).resolves.toEqual({ status: "deferred" });
    expect(verifyStandingWorkEligibility).not.toHaveBeenCalled();
  });
});
