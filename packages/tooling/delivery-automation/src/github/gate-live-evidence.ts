import type { WorkState } from "../control/eligibility.js";
import type { ReleaseCandidateIdentity } from "../control/release-promotion-gate.js";
import {
  type OperationalOwnerActivation,
  readProjectWorkItems,
} from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import {
  type AuthorizedWorkIntegrationTarget,
  readAuthorizedWorkIntegrationTarget,
} from "./work-integration-target.js";

const validWorkStates = new Set<WorkState>([
  "Idea",
  "Exploring",
  "Designing",
  "Awaiting Approval",
  "Preparing",
  "Ready",
  "Implementing",
  "Reviewing",
  "Validating",
  "Done",
]);

interface DependencyIssue {
  readonly state: "open" | "closed";
}

interface PullRequestMergeability {
  readonly number: number;
  readonly mergeable: boolean | null;
  readonly head: { readonly sha: string };
}

interface ReleaseWorkIssue {
  readonly number: number;
  readonly state: "open" | "closed";
  readonly pull_request?: object;
}

interface TimelineEvent {
  readonly event: string;
  readonly source?: {
    readonly issue?: {
      readonly number: number;
      readonly repository_url?: string;
      readonly pull_request?: object;
    };
  };
}

interface PromotionPullRequest {
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

export interface ReleasePromotionTarget {
  readonly pullRequestNumber: number;
  readonly candidate: ReleaseCandidateIdentity;
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

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

function parseWorkState(value: string | undefined): WorkState | null {
  return value && validWorkStates.has(value as WorkState)
    ? (value as WorkState)
    : null;
}

async function readDependencyResolution(input: {
  readonly repository: string;
  readonly workNumber: number;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<boolean | null> {
  for (let page = 1; page <= 20; page += 1) {
    const response = await input.fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.workNumber}/dependencies/blocked_by?per_page=100&page=${page}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return null;
    }

    const dependencies = (await response.json()) as readonly DependencyIssue[];
    if (dependencies.some((dependency) => dependency.state === "open")) {
      return false;
    }
    if (dependencies.length < 100) {
      return true;
    }
  }

  return null;
}

async function readPullRequestMergeability(input: {
  readonly repository: string;
  readonly pullRequestNumber: number;
  readonly expectedHeadSha: string;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<boolean | null> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/pulls/${input.pullRequestNumber}`,
    { headers: headers(input.repositoryToken) },
  );
  if (!response.ok) {
    return null;
  }

  const pullRequest = (await response.json()) as PullRequestMergeability;
  if (
    pullRequest.number !== input.pullRequestNumber ||
    pullRequest.head.sha !== input.expectedHeadSha
  ) {
    return null;
  }
  return pullRequest.mergeable;
}

export type WorkMergeGateLiveEvidenceResolution =
  | {
      readonly status: "ready";
      readonly workState: WorkState;
      readonly dependenciesResolved: boolean;
      readonly pullRequestMergeable: boolean;
      readonly target: AuthorizedWorkIntegrationTarget;
    }
  | {
      readonly status: "blocked";
      readonly reason:
        | "WORK_STATE_OWNER_INACTIVE"
        | "DEPENDENCY_OWNER_INACTIVE"
        | "WORK_INTEGRATION_PR_OWNER_INACTIVE"
        | "WORK_INTEGRATION_PR_UNAVAILABLE"
        | "WORK_ITEM_UNAVAILABLE"
        | "WORK_STATE_UNAVAILABLE"
        | "DEPENDENCY_STATE_UNAVAILABLE"
        | "PR_MERGEABILITY_UNAVAILABLE";
    };

export async function readWorkMergeGateLiveEvidence(input: {
  readonly repository: string;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly repositoryToken: string;
  readonly workNumber: number;
  readonly activation: OperationalOwnerActivation;
  readonly fetchImpl?: FetchLike;
}): Promise<WorkMergeGateLiveEvidenceResolution> {
  if (!input.activation.workState) {
    return { status: "blocked", reason: "WORK_STATE_OWNER_INACTIVE" };
  }
  if (!input.activation.dependencies) {
    return { status: "blocked", reason: "DEPENDENCY_OWNER_INACTIVE" };
  }
  if (!input.activation.workIntegrationPr) {
    return {
      status: "blocked",
      reason: "WORK_INTEGRATION_PR_OWNER_INACTIVE",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const [items, target, dependenciesResolved] = await Promise.all([
    readProjectWorkItems({
      repository: input.repository,
      projectId: input.projectId,
      projectsToken: input.projectsToken,
      fetchImpl,
    }),
    readAuthorizedWorkIntegrationTarget({
      repository: input.repository,
      workNumber: input.workNumber,
      repositoryToken: input.repositoryToken,
      active: true,
      fetchImpl,
    }),
    readDependencyResolution({
      repository: input.repository,
      workNumber: input.workNumber,
      repositoryToken: input.repositoryToken,
      fetchImpl,
    }),
  ]);

  if (target.status !== "selected") {
    return { status: "blocked", reason: "WORK_INTEGRATION_PR_UNAVAILABLE" };
  }

  const work = items.find((item) => item.issueNumber === input.workNumber);
  if (!work || !work.issueOpen) {
    return { status: "blocked", reason: "WORK_ITEM_UNAVAILABLE" };
  }

  const workState = parseWorkState(work.fields["Work State"]);
  if (!workState) {
    return { status: "blocked", reason: "WORK_STATE_UNAVAILABLE" };
  }
  if (dependenciesResolved === null) {
    return { status: "blocked", reason: "DEPENDENCY_STATE_UNAVAILABLE" };
  }

  const pullRequestMergeable = await readPullRequestMergeability({
    repository: input.repository,
    pullRequestNumber: target.target.pullRequestNumber,
    expectedHeadSha: target.target.headSha,
    repositoryToken: input.repositoryToken,
    fetchImpl,
  });
  if (pullRequestMergeable === null) {
    return { status: "blocked", reason: "PR_MERGEABILITY_UNAVAILABLE" };
  }

  return {
    status: "ready",
    workState,
    dependenciesResolved,
    pullRequestMergeable,
    target: target.target,
  };
}

export async function readReleasePromotionTarget(input: {
  readonly repository: string;
  readonly releaseWorkNumber: number;
  readonly repositoryToken: string;
  readonly artifactIdentity: string | null;
  readonly fetchImpl?: FetchLike;
}): Promise<
  | { readonly status: "selected"; readonly target: ReleasePromotionTarget }
  | { readonly status: "unavailable" }
  | { readonly status: "ambiguous"; readonly pullRequestNumbers: readonly number[] }
> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const workResponse = await fetchImpl(
    `https://api.github.com/repos/${input.repository}/issues/${input.releaseWorkNumber}`,
    { headers: headers(input.repositoryToken) },
  );
  if (!workResponse.ok) {
    return { status: "unavailable" };
  }
  const releaseWork = (await workResponse.json()) as ReleaseWorkIssue;
  if (
    releaseWork.number !== input.releaseWorkNumber ||
    releaseWork.state !== "open" ||
    releaseWork.pull_request
  ) {
    return { status: "unavailable" };
  }

  const referencedNumbers = new Set<number>();
  const expectedRepositoryUrl = normalizeUrl(repositoryApiUrl(input.repository));

  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${input.repository}/issues/${input.releaseWorkNumber}/timeline?per_page=100&page=${page}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return { status: "unavailable" };
    }

    const events = (await response.json()) as readonly TimelineEvent[];
    for (const event of events) {
      const sourceIssue =
        event.event === "cross-referenced" ? event.source?.issue : undefined;
      if (
        sourceIssue?.pull_request &&
        typeof sourceIssue.repository_url === "string" &&
        normalizeUrl(sourceIssue.repository_url) === expectedRepositoryUrl
      ) {
        referencedNumbers.add(sourceIssue.number);
      }
    }
    if (events.length < 100) {
      break;
    }
    if (page === 20) {
      return { status: "unavailable" };
    }
  }

  const candidates: ReleasePromotionTarget[] = [];
  for (const number of referencedNumbers) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${input.repository}/pulls/${number}`,
      { headers: headers(input.repositoryToken) },
    );
    if (!response.ok) {
      return { status: "unavailable" };
    }

    const pullRequest = (await response.json()) as PromotionPullRequest;
    if (
      pullRequest.state !== "open" ||
      pullRequest.merged ||
      pullRequest.base.ref !== "main" ||
      !pullRequest.head.ref.startsWith("release/") ||
      !pullRequest.head.sha ||
      normalizeRepository(pullRequest.head.repo?.full_name ?? "") !==
        normalizeRepository(input.repository)
    ) {
      continue;
    }

    candidates.push({
      pullRequestNumber: pullRequest.number,
      candidate: {
        sourceRef: pullRequest.head.ref,
        sourceSha: pullRequest.head.sha,
        artifactIdentity: input.artifactIdentity,
      },
    });
  }

  const sorted = candidates.toSorted(
    (left, right) => left.pullRequestNumber - right.pullRequestNumber,
  );
  if (sorted.length === 0) {
    return { status: "unavailable" };
  }
  if (sorted.length > 1) {
    return {
      status: "ambiguous",
      pullRequestNumbers: sorted.map((candidate) => candidate.pullRequestNumber),
    };
  }

  const target = sorted[0];
  if (!target) {
    throw new Error("Release promotion target selection invariant violated");
  }
  return { status: "selected", target };
}
