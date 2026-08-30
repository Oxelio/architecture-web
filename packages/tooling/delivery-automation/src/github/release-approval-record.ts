import type {
  HumanReleaseApprovalEvidence,
  ReleaseCandidateIdentity,
} from "../control/release-promotion-gate.js";
import type { FetchLike } from "./github-project-inventory.js";

const marker = "<!-- architecture-web:human-release-approval:v1 -->";

interface IssueComment {
  readonly id: number;
  readonly html_url: string;
  readonly body: string;
  readonly user?: {
    readonly login?: string;
    readonly type?: string;
  } | null;
}

interface PermissionResponse {
  readonly role_name?: string;
}

export interface HumanReleaseApprovalRecord {
  readonly decision: "approved" | "revoked";
  readonly candidate: ReleaseCandidateIdentity;
  readonly author: string;
  readonly commentId: number;
  readonly url: string;
}

export type HumanReleaseApprovalResolution =
  | {
      readonly status: "resolved";
      readonly evidence: HumanReleaseApprovalEvidence;
      readonly record: HumanReleaseApprovalRecord | null;
      readonly diagnostic: string | null;
    }
  | {
      readonly status: "unavailable";
      readonly diagnostic: string;
    };

type HumanReleaseAuthorityResolution =
  | { readonly status: "authorized" }
  | { readonly status: "unauthorized" }
  | { readonly status: "unavailable"; readonly diagnostic: string };

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

function stripCode(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("`") && trimmed.endsWith("`")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

function field(body: string, name: string): string | null {
  const line = body
    .split(/\r?\n/u)
    .find((candidate) => candidate.trimStart().startsWith(`${name}:`));
  if (!line) {
    return null;
  }
  return stripCode(line.slice(line.indexOf(":") + 1));
}

export function parseHumanReleaseApprovalComment(input: {
  readonly body: string;
  readonly author: string;
  readonly commentId: number;
  readonly url: string;
}): HumanReleaseApprovalRecord | null {
  if (!input.body.includes(marker)) {
    return null;
  }

  const authority = field(input.body, "Authority");
  const decision = field(input.body, "Decision")?.toLowerCase();
  const sourceRef = field(input.body, "Candidate Source Ref");
  const sourceSha = field(input.body, "Candidate Source SHA");
  const artifact = field(input.body, "Candidate Artifact Identity");

  if (authority !== "Human Release Authority") {
    throw new Error("Human Release Approval record has invalid Authority");
  }
  if (decision !== "approved" && decision !== "revoked") {
    throw new Error("Human Release Approval record has invalid Decision");
  }
  if (!sourceRef?.startsWith("release/")) {
    throw new Error("Human Release Approval record has invalid candidate ref");
  }
  if (!sourceSha || !/^[0-9a-f]{40}$/iu.test(sourceSha)) {
    throw new Error("Human Release Approval record has invalid candidate SHA");
  }
  if (!artifact) {
    throw new Error(
      "Human Release Approval record must declare Candidate Artifact Identity",
    );
  }

  return {
    decision,
    candidate: {
      sourceRef,
      sourceSha,
      artifactIdentity: artifact.toLowerCase() === "none" ? null : artifact,
    },
    author: input.author,
    commentId: input.commentId,
    url: input.url,
  };
}

async function resolveHumanReleaseAuthority(input: {
  readonly repository: string;
  readonly login: string;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<HumanReleaseAuthorityResolution> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/collaborators/${input.login}/permission`,
    { headers: headers(input.repositoryToken) },
  );
  if (response.status === 404) {
    return { status: "unauthorized" };
  }
  if (!response.ok) {
    return {
      status: "unavailable",
      diagnostic: `Human Release Authority lookup unavailable for @${input.login} (HTTP ${response.status})`,
    };
  }

  const payload = (await response.json()) as PermissionResponse;
  if (typeof payload.role_name !== "string") {
    return {
      status: "unavailable",
      diagnostic: `Human Release Authority lookup returned no role for @${input.login}`,
    };
  }

  return payload.role_name === "admin" || payload.role_name === "maintain"
    ? { status: "authorized" }
    : { status: "unauthorized" };
}

export async function readHumanReleaseApproval(input: {
  readonly repository: string;
  readonly releaseWorkNumber: number;
  readonly repositoryToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<HumanReleaseApprovalResolution> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const markedComments: IssueComment[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.releaseWorkNumber}/comments?per_page=100&page=${page}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return {
        status: "unavailable",
        diagnostic: `Human Release Approval comments unavailable (HTTP ${response.status})`,
      };
    }

    const comments = (await response.json()) as readonly IssueComment[];
    markedComments.push(
      ...comments.filter((comment) => comment.body.includes(marker)),
    );
    if (comments.length < 100) {
      break;
    }
    if (page === 20) {
      return {
        status: "unavailable",
        diagnostic: "Human Release Approval comment pagination exceeded limit",
      };
    }
  }

  const latest = markedComments
    .toSorted((left, right) => left.id - right.id)
    .at(-1);
  if (!latest) {
    return {
      status: "resolved",
      evidence: { exists: false, approvedCandidate: null },
      record: null,
      diagnostic: "No Human Release Approval record exists",
    };
  }

  const author = latest.user?.login;
  if (!author || latest.user?.type !== "User") {
    return {
      status: "resolved",
      evidence: { exists: false, approvedCandidate: null },
      record: null,
      diagnostic:
        "Latest Human Release Approval record is not authored by a human GitHub user",
    };
  }

  let record: HumanReleaseApprovalRecord;
  try {
    const parsed = parseHumanReleaseApprovalComment({
      body: latest.body,
      author,
      commentId: latest.id,
      url: latest.html_url,
    });
    if (!parsed) {
      throw new Error("Latest approval marker could not be parsed");
    }
    record = parsed;
  } catch (error: unknown) {
    return {
      status: "resolved",
      evidence: { exists: false, approvedCandidate: null },
      record: null,
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }

  const authority = await resolveHumanReleaseAuthority({
    repository: input.repository,
    login: record.author,
    repositoryToken: input.repositoryToken,
    fetchImpl,
  });
  if (authority.status === "unavailable") {
    return authority;
  }
  if (authority.status === "unauthorized") {
    return {
      status: "resolved",
      evidence: { exists: false, approvedCandidate: null },
      record,
      diagnostic: `Approval author @${record.author} does not have maintain/admin repository role`,
    };
  }

  if (record.decision === "revoked") {
    return {
      status: "resolved",
      evidence: { exists: false, approvedCandidate: null },
      record,
      diagnostic: "Latest Human Release Approval record revokes approval",
    };
  }

  return {
    status: "resolved",
    evidence: { exists: true, approvedCandidate: record.candidate },
    record,
    diagnostic: null,
  };
}

export const humanReleaseApprovalCommentMarker = marker;
