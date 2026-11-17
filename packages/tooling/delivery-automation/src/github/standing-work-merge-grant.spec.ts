import { describe, expect, it } from "vitest";

import {
  discoverStandingWorkMergeGrant,
  type StandingEvidenceAuthority,
} from "./work-merge-publisher.js";

const repository = "Oxelio/architecture-web";
const repoUrl = `https://api.github.com/repos/${repository}`;
const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const authority: StandingEvidenceAuthority = {
  "code-review": [{ authorId: 17, appId: 4 }],
  validation: [{ authorId: 18, appId: 5 }],
  "working-decisions": [{ authorId: 19, appId: null }],
};

function comment(
  id: number,
  kind: string,
  authorId: number,
  appId: number | null,
  decision = "accepted",
) {
  return {
    id,
    issue_url: `${repoUrl}/issues/${candidate.workNumber}`,
    body: JSON.stringify({ ...candidate, kind, decision }),
    user: { id: authorId, type: "User" },
    performed_via_github_app: appId === null ? null : { id: appId },
    created_at: "2026-11-12T12:00:00Z",
    updated_at: "2026-11-12T12:00:00Z",
  };
}

function fixture() {
  const state = {
    comments: [
      comment(2, "validation", 18, 5),
      comment(3, "working-decisions", 19, null),
      comment(1, "code-review", 17, 4),
    ],
    tasks: [
      {
        number: 138,
        repository_url: repoUrl,
        state: "closed",
        state_reason: "completed",
      },
    ],
  };
  const publisher = {
    repository,
    repositoryId: 1336937640,
    actorId: 20,
    repositoryToken: "test-reader",
    fetchImpl: async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/issues/115/comments")) {
        return Response.json(state.comments);
      }
      if (path.endsWith("/issues/141/comments")) {
        return Response.json([]);
      }
      if (path.endsWith("/issues/115/sub_issues")) {
        return Response.json(state.tasks);
      }
      return new Response(null, { status: 404 });
    },
  };
  const policy = { gateAppId: 7, rulesetId: 8, authority };
  return {
    state,
    publisher,
    policy,
    read: () => discoverStandingWorkMergeGrant(publisher, candidate, policy),
  };
}

describe("standing candidate evidence discovery", () => {
  it("discovers attributable records and completed tasks without per-PR grant input", async () => {
    const f = fixture();
    f.state.comments.push(comment(4, "code-review", 17, 999));
    expect(await f.read()).toMatchObject({
      repositoryId: 1336937640,
      workNumber: 115,
      pullNumber: 141,
      auto: true,
      direct: false,
      requiredTasks: [138],
      evidence: [
        { kind: "code-review", commentId: 1, authorId: 17 },
        { kind: "validation", commentId: 2, authorId: 18 },
        { kind: "working-decisions", commentId: 3, authorId: 19 },
      ],
    });
  });

  it("fails closed if a current authorized record is rejected, edited, or ambiguous", async () => {
    for (const extra of [
      comment(4, "code-review", 17, 4, "rejected"),
      {
        ...comment(4, "code-review", 17, 4),
        updated_at: "2026-11-12T12:01:00Z",
      },
      comment(4, "code-review", 17, 4),
    ]) {
      const f = fixture();
      f.state.comments.push(extra);
      expect(await f.read()).toBeNull();
    }
  });

  it("fails closed for stale evidence, incomplete review authority, or an open Task", async () => {
    const f = fixture();
    expect(
      await discoverStandingWorkMergeGrant(
        f.publisher,
        { ...candidate, baseSha: "c".repeat(40) },
        f.policy,
      ),
    ).toBeNull();
    expect(
      await discoverStandingWorkMergeGrant(f.publisher, candidate, {
        ...f.policy,
        authority: {
          ...authority,
          "architecture-review": [{ authorId: 20, appId: 4 }],
        },
      }),
    ).toBeNull();
    f.state.tasks.push({
      number: 139,
      repository_url: repoUrl,
      state: "open",
      state_reason: "reopened",
    });
    expect(await f.read()).toBeNull();
  });
});
