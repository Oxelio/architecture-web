import { describe, expect, it, vi } from "vitest";

import {
  readStandingEvidenceWakeup,
  readStandingIntegrationWakeup,
} from "./standing-integration-wakeup.js";

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

describe("candidate-bound evidence wakeup", () => {
  const candidate = { workNumber: 115, pullNumber: 141, headSha, baseSha };
  const record = { ...candidate, kind: "code-review", decision: "accepted" };

  function evidenceFixture() {
    const { readPull, ownsCandidate, trustedMainSha } = fixture();
    return {
      readPull,
      ownsCandidate,
      trustedMainSha,
      authorizeSignal: vi.fn(async () => true),
      event: {
        action: "created",
        repository: repo,
        issue: { number: candidate.workNumber },
        comment: { id: 82, body: JSON.stringify(record) },
      },
    };
  }

  it("reselects the exact candidate after a late review on the Work or owning PR", async () => {
    const input = evidenceFixture();
    expect(await readStandingEvidenceWakeup(input)).toEqual({
      status: "selected",
      candidate,
    });
    const prWakeup = {
      ...input,
      event: {
        ...input.event,
        issue: { number: candidate.pullNumber, pull_request: {} },
      },
    };
    expect(await readStandingEvidenceWakeup(prWakeup)).toEqual({
      status: "selected",
      candidate,
    });
    expect(input.readPull).toHaveBeenCalledWith(candidate.pullNumber);
    expect(input.ownsCandidate).toHaveBeenCalledTimes(2);
  });

  it("ignores unrelated, malformed or rejected evidence without reading a PR", async () => {
    const input = evidenceFixture();
    for (const change of [
      { comment: { body: "not evidence" } },
      {
        comment: { body: JSON.stringify({ ...record, decision: "rejected" }) },
      },
      { issue: { number: 999 } },
      { repository: { id: 3 } },
      { action: "edited" },
    ]) {
      expect(
        await readStandingEvidenceWakeup({
          ...input,
          event: { ...input.event, ...change },
        }),
      ).toEqual({ status: "ignored" });
    }
    expect(input.readPull).not.toHaveBeenCalled();
  });

  it("keeps unauthorized comments outside the protected queue", async () => {
    const input = evidenceFixture();
    input.authorizeSignal.mockResolvedValue(false);
    expect(await readStandingEvidenceWakeup(input)).toEqual({
      status: "ignored",
    });
    expect(input.readPull).not.toHaveBeenCalled();
  });

  it("ignores evidence for a previous candidate even when the Work and PR still match", async () => {
    const input = evidenceFixture();
    const stale = { ...record, headSha: "c".repeat(40) };
    input.event.comment.body = JSON.stringify(stale);
    expect(await readStandingEvidenceWakeup(input)).toEqual({
      status: "ignored",
    });
    expect(input.ownsCandidate).not.toHaveBeenCalled();
  });
});
