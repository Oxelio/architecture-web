import { resolveWorkIntegrationPr } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";

export interface AuthorizedWorkIntegrationTarget {
  readonly pullRequestNumber: number;
  readonly headRef: string;
  readonly headSha: string;
  readonly baseRef: string;
}

export type WorkIntegrationTargetResolution =
  | {
      readonly status: "selected";
      readonly target: AuthorizedWorkIntegrationTarget;
    }
  | { readonly status: "unavailable"; readonly reason: string }
  | {
      readonly status: "ambiguous";
      readonly pullRequestNumbers: readonly number[];
    };

interface PullRequestDetail {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly merged: boolean;
  readonly base: { readonly ref: string };
  readonly head: {
    readonly ref: string;
    readonly sha: string;
    readonly repo?: { readonly full_name: string } | null;
  };
}

interface CrossReferenceTimelineEvent {
  readonly event: string;
  readonly source?: {
    readonly issue?: {
      readonly number: number;
      readonly repository_url?: string;
      readonly pull_request?: object;
    };
  };
}

function normalizeRepository(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "").toLowerCase();
}

function repositoryApiUrl(repository: string): string {
  return `https://api.github.com/repos/${repository}`;
}

function isAllowedBase(baseRef: string): boolean {
  return baseRef === "main";
}

function isAllowedWorkHead(headRef: string): boolean {
  return (
    headRef !== "main" &&
    headRef !== "development" &&
    !headRef.startsWith("release/")
  );
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

async function verifySameRepositoryCrossReference(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly pullRequestNumber: number;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<"verified" | "missing" | "unavailable"> {
  const expectedRepositoryUrl = normalizeUrl(
    repositoryApiUrl(input.repository),
  );

  for (let page = 1; page <= 20; page += 1) {
    const response = await input.fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.workNumber}/timeline?per_page=100&page=${page}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return "unavailable";
    }

    const events =
      (await response.json()) as readonly CrossReferenceTimelineEvent[];
    const matched = events.some((event) => {
      const sourceIssue =
        event.event === "cross-referenced" ? event.source?.issue : undefined;
      return (
        sourceIssue?.pull_request !== undefined &&
        sourceIssue.number === input.pullRequestNumber &&
        typeof sourceIssue.repository_url === "string" &&
        normalizeUrl(sourceIssue.repository_url) === expectedRepositoryUrl
      );
    });
    if (matched) {
      return "verified";
    }
    if (events.length < 100) {
      return "missing";
    }
    if (page === 20) {
      return "unavailable";
    }
  }

  return "unavailable";
}

export async function readAuthorizedWorkIntegrationTarget(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly repositoryToken: string;
  readonly active: boolean;
  readonly fetchImpl?: FetchLike;
}): Promise<WorkIntegrationTargetResolution> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const resolution = await resolveWorkIntegrationPr({
    repository: input.repository,
    workNumber: input.workNumber,
    repositoryToken: input.repositoryToken,
    active: input.active,
    fetchImpl,
  });

  if (resolution.status === "unavailable") {
    return { status: "unavailable", reason: "WORK_INTEGRATION_PR_UNAVAILABLE" };
  }
  if (resolution.status === "ambiguous") {
    return {
      status: "ambiguous",
      pullRequestNumbers: resolution.candidates.map(
        (candidate) => candidate.number,
      ),
    };
  }

  const expected = resolution.pullRequest;
  const reference = await verifySameRepositoryCrossReference({
    repository: input.repository,
    workNumber: input.workNumber,
    pullRequestNumber: expected.number,
    repositoryToken: input.repositoryToken,
    fetchImpl,
  });
  if (reference !== "verified") {
    return {
      status: "unavailable",
      reason:
        reference === "unavailable"
          ? "WORK_INTEGRATION_PR_REFERENCE_UNAVAILABLE"
          : "WORK_INTEGRATION_PR_REFERENCE_CHANGED",
    };
  }

  const response = await fetchImpl(
    `https://api.github.com/repos/${input.repository}/pulls/${expected.number}`,
    { headers: headers(input.repositoryToken) },
  );
  if (!response.ok) {
    return {
      status: "unavailable",
      reason: "WORK_INTEGRATION_PR_REREAD_FAILED",
    };
  }

  const actual = (await response.json()) as PullRequestDetail;
  if (
    actual.number !== expected.number ||
    actual.state !== "open" ||
    actual.merged ||
    normalizeRepository(actual.head.repo?.full_name ?? "") !==
      normalizeRepository(input.repository) ||
    actual.head.ref !== expected.headRef ||
    actual.base.ref !== expected.baseRef ||
    !isAllowedBase(actual.base.ref) ||
    !isAllowedWorkHead(actual.head.ref) ||
    !actual.head.sha
  ) {
    return { status: "unavailable", reason: "WORK_INTEGRATION_PR_CHANGED" };
  }

  return {
    status: "selected",
    target: {
      pullRequestNumber: actual.number,
      headRef: actual.head.ref,
      headSha: actual.head.sha,
      baseRef: actual.base.ref,
    },
  };
}

export async function verifyAuthorizedWorkIntegrationTarget(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly repositoryToken: string;
  readonly active: boolean;
  readonly expected: AuthorizedWorkIntegrationTarget;
  readonly fetchImpl?: FetchLike;
}): Promise<
  | { readonly status: "verified" }
  | { readonly status: "changed"; readonly reason: string }
> {
  const current = await readAuthorizedWorkIntegrationTarget(input);
  if (current.status !== "selected") {
    return {
      status: "changed",
      reason:
        current.status === "ambiguous"
          ? "WORK_INTEGRATION_PR_AMBIGUOUS"
          : current.reason,
    };
  }

  const actual = current.target;
  if (
    actual.pullRequestNumber !== input.expected.pullRequestNumber ||
    actual.headRef !== input.expected.headRef ||
    actual.headSha !== input.expected.headSha ||
    actual.baseRef !== input.expected.baseRef
  ) {
    return { status: "changed", reason: "WORK_INTEGRATION_TARGET_CHANGED" };
  }

  return { status: "verified" };
}
