import { describe, expect, it, vi } from "vitest";

import {
  parseHumanReleaseApprovalComment,
  readHumanReleaseApproval,
} from "./release-approval-record.js";

const approvalBody = `<!-- architecture-web:human-release-approval:v1 -->
Authority: Human Release Authority
Decision: APPROVED
Candidate Source Ref: release/1.2.3
Candidate Source SHA: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Candidate Artifact Identity: artifact-123`;

describe("parseHumanReleaseApprovalComment", () => {
  it("parses a candidate-specific human release approval record", () => {
    expect(
      parseHumanReleaseApprovalComment({
        body: approvalBody,
        author: "maintainer",
        commentId: 10,
        url: "https://github.test/comment/10",
      }),
    ).toEqual({
      decision: "approved",
      candidate: {
        sourceRef: "release/1.2.3",
        sourceSha: "a".repeat(40),
        artifactIdentity: "artifact-123",
      },
      author: "maintainer",
      commentId: 10,
      url: "https://github.test/comment/10",
    });
  });

  it("requires an explicit Human Release Authority declaration", () => {
    expect(() =>
      parseHumanReleaseApprovalComment({
        body: approvalBody.replace(
          "Authority: Human Release Authority",
          "Authority: Maintainer",
        ),
        author: "maintainer",
        commentId: 10,
        url: "https://github.test/comment/10",
      }),
    ).toThrow("invalid Authority");
  });
});

describe("readHumanReleaseApproval", () => {
  it("accepts the latest approval only when the author has maintain/admin role", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/comments?")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              html_url: "https://github.test/comment/10",
              body: approvalBody,
              user: { login: "maintainer", type: "User" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/collaborators/maintainer/permission")) {
        return new Response(
          JSON.stringify({ permission: "write", role_name: "maintain" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await readHumanReleaseApproval({
      repository: "Oxelio/Architecture-Web",
      releaseWorkNumber: 20,
      repositoryToken: "repo-token",
      fetchImpl,
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      throw new Error("Expected resolved approval");
    }
    expect(result.evidence).toEqual({
      exists: true,
      approvedCandidate: {
        sourceRef: "release/1.2.3",
        sourceSha: "a".repeat(40),
        artifactIdentity: "artifact-123",
      },
    });
  });

  it("treats a latest revocation as no approval", async () => {
    const revoked = approvalBody.replace(
      "Decision: APPROVED",
      "Decision: REVOKED",
    );
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/comments?")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              html_url: "https://github.test/comment/10",
              body: approvalBody,
              user: { login: "maintainer", type: "User" },
            },
            {
              id: 11,
              html_url: "https://github.test/comment/11",
              body: revoked,
              user: { login: "maintainer", type: "User" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/collaborators/maintainer/permission")) {
        return new Response(
          JSON.stringify({ permission: "admin", role_name: "admin" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await readHumanReleaseApproval({
      repository: "Oxelio/Architecture-Web",
      releaseWorkNumber: 20,
      repositoryToken: "repo-token",
      fetchImpl,
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      throw new Error("Expected resolved approval");
    }
    expect(result.evidence).toEqual({
      exists: false,
      approvedCandidate: null,
    });
    expect(result.diagnostic).toContain("revokes approval");
  });

  it("fails closed when the approval author lacks maintain/admin role", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/comments?")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              html_url: "https://github.test/comment/10",
              body: approvalBody,
              user: { login: "contributor", type: "User" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/collaborators/contributor/permission")) {
        return new Response(
          JSON.stringify({ permission: "write", role_name: "write" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await readHumanReleaseApproval({
      repository: "Oxelio/Architecture-Web",
      releaseWorkNumber: 20,
      repositoryToken: "repo-token",
      fetchImpl,
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      throw new Error("Expected resolved approval");
    }
    expect(result.evidence.exists).toBe(false);
    expect(result.diagnostic).toContain("maintain/admin");
  });

  it("keeps permission API failures as technical unavailability", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/comments?")) {
        return new Response(
          JSON.stringify([
            {
              id: 10,
              html_url: "https://github.test/comment/10",
              body: approvalBody,
              user: { login: "maintainer", type: "User" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/collaborators/maintainer/permission")) {
        return new Response("service unavailable", { status: 503 });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    await expect(
      readHumanReleaseApproval({
        repository: "Oxelio/Architecture-Web",
        releaseWorkNumber: 20,
        repositoryToken: "repo-token",
        fetchImpl,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      diagnostic:
        "Human Release Authority lookup unavailable for @maintainer (HTTP 503)",
    });
  });
});
