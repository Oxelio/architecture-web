import type { MergeCandidate } from "./work-merge-publisher.js";

const connectorAppId = 1144995;
const repositoryId = 1336937640;
const maintainerId = 83680141;
const repositoryUrl = "https://api.github.com/repos/Oxelio/architecture-web";
const prefix = "/architecture-web direct-squash\n";

interface RequestComment {
  readonly id?: number;
  readonly body?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly issue_url?: string;
  readonly user?: { readonly id?: number; readonly type?: string };
  readonly performed_via_github_app?: { readonly id?: number } | null;
}

export interface DirectSquashEvent {
  readonly action?: string;
  readonly repository?: {
    readonly id?: number;
    readonly default_branch?: string;
  };
  readonly issue?: { readonly number?: number; readonly pull_request?: object };
  readonly sender?: { readonly id?: number };
  readonly comment?: RequestComment;
}

interface DirectSquashGrant extends MergeCandidate {
  readonly operation: "direct-squash";
  readonly repositoryId: number;
  readonly actorId: number;
  readonly appId: number;
  readonly expiresAt: string;
}

export type DirectSquashRequest =
  | {
      readonly status: "authenticated";
      readonly commentId: number;
      readonly candidate: MergeCandidate;
    }
  | { readonly status: "ignored" | "blocked"; readonly reason: string };

export async function authenticateDirectSquashRequest(input: {
  readonly event: DirectSquashEvent;
  readonly ref: string;
  readonly runAttempt: string;
  readonly actorId: number;
  readonly now: number;
  readonly readGrant: () => Promise<DirectSquashGrant | null>;
  readonly readComment: (id: number) => Promise<RequestComment>;
  readonly workOwnsCandidate: (candidate: MergeCandidate) => Promise<boolean>;
  readonly readCandidate: (number: number) => Promise<{
    readonly number?: number;
    readonly state?: string;
    readonly draft?: boolean;
    readonly merged?: boolean;
    readonly head?: {
      readonly sha?: string;
      readonly repo?: { readonly id?: number };
    };
    readonly base?: {
      readonly ref?: string;
      readonly sha?: string;
      readonly repo?: { readonly id?: number };
    };
  }>;
}): Promise<DirectSquashRequest> {
  const { event, ref, runAttempt, actorId } = input;
  const original = event.comment;
  if (!original?.body?.startsWith(prefix)) {
    return { status: "ignored", reason: "NOT_AN_INTEGRATION_REQUEST" };
  }
  const blocked = (reason: string): DirectSquashRequest => ({
    status: "blocked",
    reason,
  });
  if (
    ref !== "refs/heads/main" ||
    runAttempt !== "1" ||
    event.action !== "created" ||
    event.repository?.id !== repositoryId ||
    event.repository.default_branch !== "main" ||
    actorId !== maintainerId ||
    event.sender?.id !== actorId ||
    !event.issue?.pull_request ||
    !original.id ||
    !Number.isSafeInteger(original.id) ||
    original.id <= 0
  ) {
    return blocked("UNTRUSTED_REQUEST_EVENT");
  }

  const comment = await input.readComment(original.id);
  if (
    comment.id !== original.id ||
    comment.issue_url?.toLowerCase() !==
      `${repositoryUrl.toLowerCase()}/issues/${event.issue.number}` ||
    comment.user?.id !== actorId ||
    comment.user.type !== "User" ||
    comment.performed_via_github_app?.id !== connectorAppId ||
    comment.body !== original.body ||
    !comment.created_at ||
    comment.created_at !== original.created_at ||
    comment.updated_at !== comment.created_at
  ) {
    return blocked("REQUEST_COMMENT_UNVERIFIED");
  }

  if (original.body.length > 512) {
    return blocked("INVALID_REQUEST");
  }
  let candidate: MergeCandidate;
  try {
    candidate = JSON.parse(
      original.body.slice(prefix.length),
    ) as MergeCandidate;
  } catch {
    return blocked("INVALID_REQUEST");
  }
  if (
    !candidate ||
    Object.keys(candidate).length !== 4 ||
    !Number.isSafeInteger(candidate.workNumber) ||
    candidate.workNumber <= 0 ||
    candidate.workNumber === 91 ||
    candidate.workNumber === 93 ||
    !Number.isSafeInteger(candidate.pullNumber) ||
    candidate.pullNumber <= 0 ||
    candidate.pullNumber === 94 ||
    candidate.pullNumber !== event.issue.number ||
    !/^[0-9a-f]{40}$/u.test(candidate.headSha) ||
    !/^[0-9a-f]{40}$/u.test(candidate.baseSha)
  ) {
    return blocked("INVALID_REQUEST");
  }

  const grant = await input.readGrant();
  const createdAt = Date.parse(comment.created_at);
  const expiresAt = Date.parse(grant?.expiresAt ?? "");
  if (
    !grant ||
    grant.operation !== "direct-squash" ||
    grant.repositoryId !== repositoryId ||
    grant.actorId !== actorId ||
    grant.appId !== connectorAppId ||
    grant.workNumber !== candidate.workNumber ||
    grant.pullNumber !== candidate.pullNumber ||
    grant.headSha !== candidate.headSha ||
    grant.baseSha !== candidate.baseSha ||
    !(
      createdAt <= input.now &&
      input.now - createdAt <= 10 * 60_000 &&
      input.now < expiresAt
    )
  ) {
    return blocked("REQUEST_GRANT_UNVERIFIED");
  }

  const pr = await input.readCandidate(candidate.pullNumber);
  if (
    pr.number !== candidate.pullNumber ||
    pr.state !== "open" ||
    pr.draft !== false ||
    pr.merged !== false ||
    pr.base?.ref !== "main" ||
    pr.base.repo?.id !== repositoryId ||
    pr.head?.repo?.id !== repositoryId ||
    pr.head.sha !== candidate.headSha ||
    pr.base.sha !== candidate.baseSha
  ) {
    return blocked("CANDIDATE_CHANGED");
  }
  if (!(await input.workOwnsCandidate(candidate))) {
    return blocked("WORK_INTEGRATION_PR_UNVERIFIED");
  }
  const currentGrant = await input.readGrant();
  if (!currentGrant || JSON.stringify(currentGrant) !== JSON.stringify(grant)) {
    return blocked("REQUEST_GRANT_CHANGED");
  }
  return { status: "authenticated", commentId: comment.id, candidate };
}
