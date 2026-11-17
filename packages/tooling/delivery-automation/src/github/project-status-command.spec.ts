import { describe, expect, it } from "vitest";

import {
  authenticateProjectStatusCommand,
  claimProjectStatusCommand,
  type ProjectStatusComment,
} from "./project-status-command.js";

const command = {
  kind: "record-work-status",
  repositoryId: 1336937640,
  projectNumber: 3,
  workNumber: 115,
  from: "Preparing",
  to: "Ready",
  evidenceCommentIds: [81],
};
const now = 1_800_000_000_000;
const comment: ProjectStatusComment = {
  id: 82,
  issue_url: "https://api.github.com/repos/Oxelio/architecture-web/issues/115",
  body: JSON.stringify(command),
  created_at: "2026-11-17T08:49:00Z",
  updated_at: "2026-11-17T08:49:00Z",
  user: { id: 83680141, type: "User" },
  performed_via_github_app: { id: 1144995 },
};
const policy = {
  kind: "work-status-channel",
  repositoryId: 1336937640,
  projectNumber: 3,
  workflowPath: ".github/workflows/delivery-project-status.yml",
  actorId: 83680141,
  appId: 1144995,
  expiresAt: new Date(now + 1000).toISOString(),
};

function authenticate(
  record: ProjectStatusComment = comment,
  channel: unknown = policy,
) {
  return authenticateProjectStatusCommand({
    workNumber: 115,
    commentId: 82,
    actorId: 83680141,
    now: () => now,
    readComment: async () => record,
    readChannelPolicy: async () => channel,
  });
}

describe("Project Status command intake", () => {
  it("binds an authenticated request to the exact Work, Status and evidence references", async () => {
    expect(await authenticate()).toEqual(command);
  });

  it.each([
    { id: 90 },
    { user: { id: 1, type: "User" } },
    { performed_via_github_app: null },
    { performed_via_github_app: { id: 1 } },
    {
      issue_url:
        "https://api.github.com/repos/Oxelio/architecture-web/issues/140",
    },
    { updated_at: "2026-11-17T08:49:01Z" },
    { body: "not JSON" },
  ])("rejects a spoofed, edited or mismatched comment", async (changes) => {
    expect(await authenticate({ ...comment, ...changes })).toBeNull();
  });

  it.each([
    null,
    { ...policy, appId: 0 },
    { ...policy, workflowPath: "other.yml" },
    { ...policy, expiresAt: new Date(now).toISOString() },
  ])("rejects an absent, wrong or expired channel policy", async (channel) => {
    expect(await authenticate(comment, channel)).toBeNull();
  });

  it.each([
    { workNumber: 140 },
    { projectNumber: 4 },
    { to: "Done" },
    { to: "Preparing" },
    { evidenceCommentIds: [81, 81] },
    { evidenceCommentIds: [82] },
    { evidenceCommentIds: [] },
  ])("rejects invalid operation or evidence bindings", async (changes) => {
    expect(
      await authenticate({
        ...comment,
        body: JSON.stringify({ ...command, ...changes }),
      }),
    ).toBeNull();
  });

  it("denies the request when GitHub cannot read the current policy", async () => {
    expect(
      await authenticateProjectStatusCommand({
        workNumber: 115,
        commentId: 82,
        actorId: 83680141,
        now: () => now,
        readComment: async () => comment,
        readChannelPolicy: async () => {
          throw new Error("unavailable");
        },
      }),
    ).toBeNull();
  });
});

describe("Project Status command receipt", () => {
  const credential = "controller-test-token";
  const head = "a".repeat(40);
  const ref = "refs/tags/delivery-control/status-82";
  const request = {
    commentId: 82,
    workflowSha: head,
    controllerToken: credential,
  };

  it("admits only the invocation that receives a matching creation response", async () => {
    const writes: unknown[] = [];
    let created = false;
    const fetchImpl: typeof fetch = async (_input, init) => {
      writes.push(JSON.parse(String(init?.body)));
      if (created) {
        return new Response(null, { status: 422 });
      }
      created = true;
      return Response.json(
        { ref, object: { type: "commit", sha: head } },
        { status: 201 },
      );
    };
    expect(await claimProjectStatusCommand({ ...request, fetchImpl })).toBe(
      true,
    );
    expect(await claimProjectStatusCommand({ ...request, fetchImpl })).toBe(
      false,
    );
    expect(writes).toEqual([
      { ref, sha: head },
      { ref, sha: head },
    ]);
  });

  it("denies a different receipt even when creation reports success", async () => {
    expect(
      await claimProjectStatusCommand({
        ...request,
        fetchImpl: async () =>
          Response.json(
            { ref, object: { type: "commit", sha: "b".repeat(40) } },
            { status: 201 },
          ),
      }),
    ).toBe(false);
  });

  it("does not retry or recover permission to initiate a write after a lost response", async () => {
    let calls = 0;
    expect(
      await claimProjectStatusCommand({
        ...request,
        fetchImpl: async () => {
          calls++;
          throw new Error("response lost");
        },
      }),
    ).toBe(false);
    expect(calls).toBe(1);
  });
});
