import { describe, expect, it, vi } from "vitest";

import { authenticateDirectSquashRequest } from "./direct-squash-request.js";

const headSha = "a".repeat(40);
const baseSha = "b".repeat(40);
const candidate = { workNumber: 97, pullNumber: 98, headSha, baseSha };
const createdAt = "2026-11-04T23:00:00Z";

function fixture() {
  const repo = { id: 1336937640, default_branch: "main" };
  const comment = {
    id: 57,
    body: `/architecture-web direct-squash\n${JSON.stringify(candidate)}`,
    created_at: createdAt,
    updated_at: createdAt,
    issue_url: "https://api.github.com/repos/Oxelio/architecture-web/issues/98",
    user: { id: 83680141, type: "User" },
    performed_via_github_app: { id: 1144995 },
  };
  const grant = {
    ...candidate,
    actorId: 83680141,
    appId: 1144995,
    repositoryId: repo.id,
    operation: "direct-squash" as const,
    expiresAt: "2026-11-04T23:20:00Z",
  };
  const pr = {
    number: 98,
    state: "open",
    draft: false,
    merged: false,
    head: { repo, sha: headSha },
    base: { repo, sha: baseSha, ref: "main" },
  };
  const input = {
    event: {
      action: "created",
      repository: repo,
      issue: { number: 98, pull_request: {} },
      sender: { id: 83680141 },
      comment: { ...comment },
    },
    ref: "refs/heads/main",
    runAttempt: "1",
    actorId: 83680141,
    now: Date.parse("2026-11-04T23:01:00Z"),
    readComment: vi
      .fn<
        Parameters<typeof authenticateDirectSquashRequest>[0]["readComment"]
      >()
      .mockResolvedValue(comment),
    readGrant: vi
      .fn<Parameters<typeof authenticateDirectSquashRequest>[0]["readGrant"]>()
      .mockResolvedValue(grant),
    readCandidate: vi
      .fn<
        Parameters<typeof authenticateDirectSquashRequest>[0]["readCandidate"]
      >()
      .mockResolvedValue(pr),
    workOwnsCandidate: vi.fn().mockResolvedValue(true),
  };
  return { input, comment, grant, pr };
}

describe("the read-only direct squash request adapter", () => {
  it("binds the authenticated request to the exact candidate and rereads authority", async () => {
    const { input } = fixture();
    await expect(authenticateDirectSquashRequest(input)).resolves.toEqual({
      status: "authenticated",
      commentId: 57,
      candidate,
    });
    expect(input.readGrant).toHaveBeenCalledTimes(2);
    expect(input.workOwnsCandidate).toHaveBeenCalledWith(candidate);
  });

  it.each([{ ref: "refs/heads/other" }, { runAttempt: "2" }, { actorId: 22 }])(
    "rejects an untrusted event context (%j) before repository access",
    async (change) => {
      const { input } = fixture();
      await expect(
        authenticateDirectSquashRequest({ ...input, ...change }),
      ).resolves.toMatchObject({
        reason: "UNTRUSTED_REQUEST_EVENT",
      });
      expect(input.readComment).not.toHaveBeenCalled();
    },
  );

  it.each([
    { performed_via_github_app: null },
    { performed_via_github_app: { id: 2 } },
    { user: { id: 2, type: "User" } },
    { updated_at: "2026-11-04T23:00:45Z" },
    { body: "edited" },
  ])("rejects altered or unverified REST comments (%j)", async (change) => {
    const { input, comment } = fixture();
    input.readComment.mockResolvedValue({ ...comment, ...change });
    await expect(authenticateDirectSquashRequest(input)).resolves.toMatchObject(
      {
        reason: "REQUEST_COMMENT_UNVERIFIED",
      },
    );
    expect(input.readGrant).not.toHaveBeenCalled();
  });

  it("rejects revoked, expired, and stale grants or requests", async () => {
    const { input, grant } = fixture();
    input.readGrant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...grant, expiresAt: createdAt });
    for (const request of [
      input,
      input,
      { ...input, now: Date.parse("2026-11-04T23:11:00Z") },
    ]) {
      await expect(
        authenticateDirectSquashRequest(request),
      ).resolves.toMatchObject({
        reason: "REQUEST_GRANT_UNVERIFIED",
      });
    }
  });

  it("rejects revocation during the read", async () => {
    const { input } = fixture();
    input.readGrant
      .mockResolvedValueOnce(fixture().grant)
      .mockResolvedValueOnce(null);
    await expect(authenticateDirectSquashRequest(input)).resolves.toMatchObject(
      {
        reason: "REQUEST_GRANT_CHANGED",
      },
    );
  });

  it("rejects a changed head, retargeted PR, and mismatched owning Work", async () => {
    const { input, pr } = fixture();
    input.readCandidate
      .mockResolvedValueOnce({ ...pr, head: { ...pr.head, sha: baseSha } })
      .mockResolvedValueOnce({ ...pr, base: { ...pr.base, ref: "other" } });
    for (const attempt of [input, input]) {
      await expect(
        authenticateDirectSquashRequest(attempt),
      ).resolves.toMatchObject({
        reason: "CANDIDATE_CHANGED",
      });
    }
    input.workOwnsCandidate.mockResolvedValue(false);
    await expect(authenticateDirectSquashRequest(input)).resolves.toMatchObject(
      {
        reason: "WORK_INTEGRATION_PR_UNVERIFIED",
      },
    );
  });
});
