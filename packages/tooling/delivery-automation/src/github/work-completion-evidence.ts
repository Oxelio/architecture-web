import type { WorkCompletionSnapshot } from "../control/work-completion.js";
import { workReference } from "./work-reference.js";

export { workReference } from "./work-reference.js";

export interface CompletionRecord {
  readonly kind: "work-completion";
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
  readonly mergeSha: string;
  readonly scopeConcluded: boolean;
  readonly reviewsAccepted: boolean;
  readonly validationSufficient: boolean;
  readonly durableOwnersSynchronized: boolean;
  readonly workingDecisionsResolved: boolean;
  readonly postMergeObligationsSatisfied: boolean;
}

interface MergedPullRequest {
  readonly number: number;
  readonly state: string;
  readonly merged: boolean;
  readonly merge_commit_sha: string;
  readonly body: string | null;
  readonly head: {
    readonly sha: string;
    readonly repo: { readonly id: number } | null;
  };
  readonly base: {
    readonly ref: string;
    readonly repo: { readonly id: number };
  };
}

export function isCompletionRecord(
  record: CompletionRecord | null,
  pullNumber: number,
): record is CompletionRecord {
  return (
    !!record &&
    record.kind === "work-completion" &&
    Number.isSafeInteger(record.workNumber) &&
    record.workNumber > 0 &&
    record.pullNumber === pullNumber &&
    [record.headSha, record.baseSha, record.mergeSha].every(
      (sha) => typeof sha === "string" && /^[0-9a-f]{40}$/u.test(sha),
    )
  );
}

export function matchesCompletedCandidate(
  record: Pick<
    CompletionRecord,
    "workNumber" | "pullNumber" | "headSha" | "baseSha" | "mergeSha"
  >,
  pr: MergedPullRequest,
  commit: {
    readonly sha: string;
    readonly parents: readonly { readonly sha: string }[];
  },
  comparison: {
    readonly status: string;
    readonly merge_base_commit: { readonly sha: string };
  },
  repositoryId: number,
): boolean {
  return (
    pr.number === record.pullNumber &&
    pr.state === "closed" &&
    pr.merged === true &&
    pr.base.ref === "main" &&
    pr.base.repo.id === repositoryId &&
    pr.head.repo?.id === repositoryId &&
    pr.head.sha === record.headSha &&
    pr.merge_commit_sha === record.mergeSha &&
    workReference(pr.body) === record.workNumber &&
    commit.sha === record.mergeSha &&
    commit.parents.length === 1 &&
    commit.parents[0]?.sha === record.baseSha &&
    (comparison.status === "ahead" || comparison.status === "identical") &&
    comparison.merge_base_commit.sha === record.mergeSha
  );
}

export function issueDisposition(
  issue: { readonly state: string; readonly state_reason: string | null },
  events: readonly { readonly event: string }[],
): WorkCompletionSnapshot["issueDisposition"] {
  if (
    events.length >= 100 ||
    events.some((event) => event.event === "reopened")
  ) {
    return "other";
  }
  if (issue.state === "closed" && issue.state_reason === "completed") {
    return "completed";
  }
  return issue.state === "open" && issue.state_reason === null
    ? "open"
    : "other";
}
