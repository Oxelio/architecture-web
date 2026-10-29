import { describe, expect, it } from "vitest";

import { assertPublicationContext, planVersion } from "./policy.js";

describe("coordinated version policy", () => {
  it.each<[string | null, string, string | null]>([
    ["0.1.0", "fix: correct behavior", "0.1.1"],
    ["0.1.0", "feat: add behavior", "0.2.0"],
    ["0.1.0", "refactor(iam)!: change contract (#57)", "0.2.0"],
    [
      "0.1.0",
      "refactor: change contract\n\nBREAKING CHANGE: incompatible contract",
      "0.2.0",
    ],
    ["1.2.0", "refactor(iam)!: change contract (#57)", "2.0.0"],
    ["1.2.0", "fix: correct behavior", "1.2.1"],
    ["1.2.0", "feat: add behavior", "1.3.0"],
    ["0.99.9", "feat!: change everything", "0.100.0"],
    [null, "feat: initial implementation", "0.1.0"],
    [null, "chore: initial repository", null],
    ["0.1.0", "docs: update guide", null],
    ["0.1.0", "perf: tune implementation", null],
    ["0.1.0", "chore: housekeeping", null],
  ])("%s with %s yields %s", async (previousVersion, message, expected) => {
    expect(
      (await planVersion({ previousVersion, messages: [message] })).version,
    ).toBe(expected);
  });

  it("applies the maximum impact once across multiple commits", async () => {
    expect(
      (
        await planVersion({
          previousVersion: "0.1.0",
          messages: ["fix: one", "feat: two", "refactor!: three", "fix: four"],
        })
      ).version,
    ).toBe("0.2.0");
  });

  it.each(["1.0.0-alpha.1", "0.2.0-beta.2", "1.0.0+build", "invalid"])(
    "rejects unsupported base %s without normalization",
    async (previousVersion) => {
      await expect(
        planVersion({ previousVersion, messages: ["fix: change"] }),
      ).rejects.toThrow("UNSUPPORTED_RELEASE_BASE");
    },
  );

  it("requires explicit first-stable intent independently of commit messages", async () => {
    expect(
      (
        await planVersion({
          previousVersion: "0.9.0",
          messages: ["feat!: first stable [release:major]"],
        })
      ).version,
    ).toBe("0.10.0");
    const firstStable = {
      actor: "maintainer",
      runId: "123",
      sourceSha: "a".repeat(40),
    };
    expect(
      (
        await planVersion({
          previousVersion: "0.9.0",
          messages: [],
          firstStable,
        })
      ).version,
    ).toBe("1.0.0");
    await expect(
      planVersion({ previousVersion: "1.0.0", messages: [], firstStable }),
    ).rejects.toThrow("INVALID_FIRST_STABLE");
  });

  it.each([
    ["refs/heads/development", "push"],
    ["refs/heads/release/0.1.0", "push"],
    ["refs/heads/work/change", "push"],
    ["refs/heads/main", "pull_request"],
    ["refs/tags/v0.1.0", "push"],
  ])("forbids publication from %s / %s", (ref, event) => {
    expect(() => assertPublicationContext({ ref, event })).toThrow(
      "PUBLICATION_REQUIRES_MAIN",
    );
  });
});
