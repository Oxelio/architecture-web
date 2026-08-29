import { describe, expect, it } from "vitest";

import type { FetchLike } from "./github-project-inventory.js";
import {
  readAuthorizedWorkIntegrationTarget,
  verifyAuthorizedWorkIntegrationTarget,
} from "./work-integration-target.js";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pr(
  sha: string,
  overrides: Partial<{
    state: "open" | "closed";
    merged: boolean;
    headRef: string;
  }> = {},
) {
  return {
    number: 13,
    state: overrides.state ?? "open",
    merged: overrides.merged ?? false,
    base: { ref: "development" },
    head: {
      ref: overrides.headRef ?? "technical/work-9",
      sha,
      repo: { full_name: "Oxelio/Architecture-Web" },
    },
  };
}

function targetFetch(firstSha = "sha-1", secondSha = firstSha): FetchLike {
  let pullReads = 0;
  return async (input) => {
    const url = String(input);
    if (url.includes("/timeline")) {
      return json([
        {
          event: "cross-referenced",
          source: {
            issue: {
              number: 13,
              state: "open",
              labels: [],
              pull_request: {},
            },
          },
        },
      ]);
    }
    if (url.endsWith("/pulls/13")) {
      pullReads += 1;
      return json(pr(pullReads === 1 ? firstSha : secondSha));
    }
    throw new Error(`Unexpected request ${url}`);
  };
}

describe("readAuthorizedWorkIntegrationTarget", () => {
  it("returns PR number, head ref, head SHA and base after a second PR read", async () => {
    await expect(
      readAuthorizedWorkIntegrationTarget({
        repository: "Oxelio/Architecture-Web",
        workNumber: 9,
        repositoryToken: "token",
        active: true,
        fetchImpl: targetFetch("sha-1"),
      }),
    ).resolves.toEqual({
      status: "selected",
      target: {
        pullRequestNumber: 13,
        headRef: "technical/work-9",
        headSha: "sha-1",
        baseRef: "development",
      },
    });
  });
});

describe("verifyAuthorizedWorkIntegrationTarget", () => {
  it("accepts the same exact target evidence", async () => {
    await expect(
      verifyAuthorizedWorkIntegrationTarget({
        repository: "Oxelio/Architecture-Web",
        workNumber: 9,
        repositoryToken: "token",
        active: true,
        expected: {
          pullRequestNumber: 13,
          headRef: "technical/work-9",
          headSha: "sha-1",
          baseRef: "development",
        },
        fetchImpl: targetFetch("sha-1"),
      }),
    ).resolves.toEqual({ status: "verified" });
  });

  it("blocks when the PR head SHA changes before dispatch", async () => {
    await expect(
      verifyAuthorizedWorkIntegrationTarget({
        repository: "Oxelio/Architecture-Web",
        workNumber: 9,
        repositoryToken: "token",
        active: true,
        expected: {
          pullRequestNumber: 13,
          headRef: "technical/work-9",
          headSha: "sha-1",
          baseRef: "development",
        },
        fetchImpl: targetFetch("sha-2"),
      }),
    ).resolves.toEqual({
      status: "changed",
      reason: "WORK_INTEGRATION_TARGET_CHANGED",
    });
  });
});
