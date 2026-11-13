import { describe, expect, it, vi } from "vitest";

import { readStandingIntegrationWakeup } from "./standing-integration-wakeup.js";

const repo = { id: 1336937640 };
const headSha = "a".repeat(40);
const baseSha = "b".repeat(40);

function fixture() {
  return {
    event: {
      action: "completed",
      repository: repo,
      workflow_run: {
        id: 332,
        path: ".github/workflows/delivery-automation-validation.yml",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
        head_sha: headSha,
        repository: repo,
        head_repository: repo,
        pull_requests: [{ number: 141 }],
      },
    },
    trustedMainSha: baseSha,
    readPull: vi.fn(async () => ({
      number: 141,
      body: "Refs #115",
      state: "open",
      draft: false,
      merged: false,
      head: { sha: headSha, repo },
      base: { sha: baseSha, ref: "main", repo },
    })),
    ownsCandidate: vi.fn(async () => true),
  };
}

describe("standing Work integration request", () => {
  it("selects the exact candidate from the repository validation wakeup and rereads ownership", async () => {
    const input = fixture();
    const candidate = { workNumber: 115, pullNumber: 141, headSha, baseSha };
    expect(await readStandingIntegrationWakeup(input)).toEqual({
      status: "selected",
      candidate,
      validationRunId: 332,
    });
    expect(input.readPull).toHaveBeenCalledWith(141);
    expect(input.ownsCandidate).toHaveBeenCalledWith(candidate);
  });

  it("ignores a failed, forked, ambiguous, or unrelated workflow without reading a PR", async () => {
    for (const change of [
      { conclusion: "failure" },
      { head_repository: { id: 9 } },
      { path: ".github/workflows/other.yml" },
      { pull_requests: [{ number: 141 }, { number: 142 }] },
      { event: "push" },
    ]) {
      const input = fixture();
      Object.assign(input.event.workflow_run, change);
      expect(await readStandingIntegrationWakeup(input)).toEqual({
        status: "ignored",
      });
      expect(input.readPull).not.toHaveBeenCalled();
    }
  });

  it("does not select a stale head or base, a draft, or an ambiguously owned PR", async () => {
    for (const change of [
      { head: { sha: "c".repeat(40), repo } },
      { base: { sha: "c".repeat(40), ref: "main", repo } },
      { draft: true },
      { body: "Refs #115\nRefs #116" },
    ]) {
      const input = fixture();
      const pr = await input.readPull();
      input.readPull.mockResolvedValue({ ...pr, ...change });
      expect(await readStandingIntegrationWakeup(input)).toEqual({
        status: "ignored",
      });
    }

    const input = fixture();
    input.ownsCandidate.mockResolvedValue(false);
    expect(await readStandingIntegrationWakeup(input)).toEqual({
      status: "ignored",
    });
  });
});
