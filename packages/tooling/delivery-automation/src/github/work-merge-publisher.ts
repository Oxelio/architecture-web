import { isDeepStrictEqual } from "node:util";

import { workMergeObservationCheckName } from "../control/work-merge-gate.js";
import { readWorkMergeGateLiveEvidence } from "./gate-live-evidence.js";
import type { OperationalOwnerActivation } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";

const gateName = "Architecture Web / Work Merge Gate";
const oid = /^[0-9a-f]{40}$/u;

export interface MergeCandidate {
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly headSha: string;
  readonly baseSha: string;
}

interface EvidenceReference {
  readonly kind:
    | "code-review"
    | "architecture-review"
    | "functional-review"
    | "specialist-review"
    | "validation"
    | "working-decisions"
    | "functional-approval"
    | "governance-approval"
    | "adr-approval";
  readonly commentId: number;
  readonly authorId: number;
}

export interface WorkMergeGrant {
  readonly actorId: number;
  readonly repositoryId: number;
  readonly workNumber: number;
  readonly pullNumber: number;
  readonly evidence: readonly EvidenceReference[];
  readonly requiredTasks: readonly number[];
  readonly gateAppId: number;
  readonly rulesetId: number;
  readonly direct: boolean;
  readonly auto: boolean;
}

interface PullRequest {
  readonly node_id: string;
  readonly title: string;
  readonly number: number;
  readonly state: string;
  readonly draft: boolean;
  readonly merged: boolean;
  readonly merge_commit_sha: string | null;
  readonly auto_merge: object | null;
  readonly head: {
    readonly sha: string;
    readonly repo: { readonly id: number };
  };
  readonly base: {
    readonly ref: string;
    readonly sha: string;
    readonly repo: { readonly id: number };
  };
}

interface CheckRun {
  readonly name: string;
  readonly head_sha: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly external_id: string | null;
  readonly app: { readonly id: number } | null;
}

interface IssueComment {
  readonly id: number;
  readonly issue_url: string;
  readonly body: string;
  readonly user: { readonly id: number; readonly type: string } | null;
  readonly performed_via_github_app?: object | null;
}

type MergeMode = "direct" | "auto";

export interface WorkMergePublisher {
  readonly repository: string;
  readonly repositoryId: number;
  readonly actorId: number;
  readonly projectId: string;
  readonly projectsToken: string;
  readonly repositoryToken: string;
  readonly mergeToken: string;
  readonly activation: OperationalOwnerActivation;
  readonly fetchImpl?: FetchLike;
  // These functions belong to the trusted composition, never the agent payload.
  readonly readGrant: () => Promise<WorkMergeGrant | null>;
  readonly withinVerifiedBoundary: <T>(
    candidate: MergeCandidate,
    mode: MergeMode,
    action: () => Promise<T>,
  ) => Promise<T | null>;
}

export type WorkMergeOutcome =
  | { readonly status: "merged" | "already-merged"; readonly sha: string }
  | { readonly status: "auto-merge-requested" }
  | {
      readonly status: "observed-checks-passed";
      readonly bypassActors: "none" | "unverified";
    }
  | { readonly status: "blocked" | "uncertain"; readonly reason: string };

const blocked = (reason: string): WorkMergeOutcome => ({
  status: "blocked",
  reason,
});

function positiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function sameCandidate(
  pr: PullRequest,
  candidate: MergeCandidate,
  repositoryId: number,
): boolean {
  return (
    pr.number === candidate.pullNumber &&
    pr.base?.ref === "main" &&
    pr.base.repo?.id === repositoryId &&
    pr.head?.repo?.id === repositoryId &&
    pr.head.sha === candidate.headSha
  );
}

async function github<T>(
  publisher: WorkMergePublisher,
  path: string,
  method = "GET",
  body?: object,
  token = publisher.repositoryToken,
): Promise<T> {
  const response = await (publisher.fetchImpl ?? fetch)(
    `https://api.github.com${path}`,
    {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      redirect: "error",
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub ${method} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function safeSquashHeadline(
  publisher: WorkMergePublisher,
  pr: PullRequest,
): Promise<string | null> {
  if (
    !pr.title?.trim() ||
    /\b(?:clos(?:e|es|ed)|fix(?:es|ed)?|resolv(?:e|es|ed))\s*:?\s+(?:(?:[\w.-]+\/[\w.-]+)?#\d+|https?:\/\/)/iu.test(
      pr.title,
    )
  ) {
    return null;
  }
  const result = await github<{
    readonly data?: {
      readonly node?: {
        readonly id: string;
        readonly closingIssuesReferences?: { readonly totalCount: number };
      };
    };
    readonly errors?: readonly unknown[];
  }>(publisher, "/graphql", "POST", {
    query: `query($id: ID!) {
      node(id: $id) { ... on PullRequest { id closingIssuesReferences(first: 1) { totalCount } } }
    }`,
    variables: { id: pr.node_id },
  });
  return !result.errors?.length &&
    result.data?.node?.id === pr.node_id &&
    result.data.node.closingIssuesReferences?.totalCount === 0
    ? pr.title
    : null;
}

function authorized(
  grant: WorkMergeGrant | null,
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  mode: MergeMode,
): grant is WorkMergeGrant {
  return (
    grant !== null &&
    grant.actorId === publisher.actorId &&
    grant.repositoryId === publisher.repositoryId &&
    grant.workNumber === candidate.workNumber &&
    grant.pullNumber === candidate.pullNumber &&
    grant[mode] === true
  );
}

async function verifyEvidence(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  grant: WorkMergeGrant,
  repoPath: string,
): Promise<string | null> {
  const kinds = new Set(grant.evidence.map((reference) => reference.kind));
  if (
    !kinds.has("code-review") ||
    !kinds.has("working-decisions") ||
    kinds.size !== grant.evidence.length
  ) {
    return "EVIDENCE_REQUIREMENTS_UNAVAILABLE";
  }
  for (const reference of grant.evidence) {
    if (!positiveId(reference.commentId) || !positiveId(reference.authorId)) {
      return "INVALID_EVIDENCE_REFERENCE";
    }
    const comment = await github<IssueComment>(
      publisher,
      `${repoPath}/issues/comments/${reference.commentId}`,
    );
    const issueUrl = comment.issue_url?.toLowerCase();
    const prefix = `https://api.github.com${repoPath.toLowerCase()}/issues/`;
    if (
      comment.id !== reference.commentId ||
      comment.user?.id !== reference.authorId ||
      (issueUrl !== `${prefix}${candidate.workNumber}` &&
        issueUrl !== `${prefix}${candidate.pullNumber}`) ||
      (reference.kind.endsWith("-approval") &&
        (comment.user.type !== "User" ||
          comment.performed_via_github_app !== null))
    ) {
      return `UNVERIFIED_EVIDENCE:${reference.kind}`;
    }
    let record: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(comment.body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return `INVALID_EVIDENCE:${reference.kind}`;
      }
      record = parsed as Record<string, unknown>;
    } catch {
      return `INVALID_EVIDENCE:${reference.kind}`;
    }
    if (
      record["kind"] !== reference.kind ||
      record["decision"] !== "accepted" ||
      record["workNumber"] !== candidate.workNumber ||
      record["pullNumber"] !== candidate.pullNumber ||
      record["headSha"] !== candidate.headSha ||
      record["baseSha"] !== candidate.baseSha
    ) {
      return `STALE_OR_UNACCEPTED_EVIDENCE:${reference.kind}`;
    }
  }
  const tasks = await github<
    readonly {
      readonly number: number;
      readonly repository_url: string;
      readonly state: string;
      readonly state_reason: string | null;
    }[]
  >(
    publisher,
    `${repoPath}/issues/${candidate.workNumber}/sub_issues?per_page=100`,
  );
  if (
    !Array.isArray(tasks) ||
    tasks.length >= 100 ||
    grant.requiredTasks.some(
      (number) =>
        !tasks.some(
          (task) =>
            task.number === number &&
            task.repository_url?.toLowerCase() ===
              `https://api.github.com${repoPath.toLowerCase()}` &&
            task.state === "closed" &&
            task.state_reason === "completed",
        ),
    )
  ) {
    return "REQUIRED_TASKS_UNRESOLVED";
  }
  return null;
}

async function verifyChecks(
  publisher: WorkMergePublisher,
  grant: WorkMergeGrant,
  repoPath: string,
  pr: PullRequest,
  mode: MergeMode,
  observe: boolean,
): Promise<string | { readonly bypassActors: "none" | "unverified" }> {
  if (
    !positiveId(grant.gateAppId) ||
    !positiveId(grant.rulesetId) ||
    !pr.merge_commit_sha ||
    !oid.test(pr.merge_commit_sha)
  ) {
    return "CHECK_CANDIDATE_UNAVAILABLE";
  }
  const ciChecks = [
    ["Quality checks", 15368],
    ["SonarCloud Code Analysis", 12526],
  ] as const;
  const expectedGateName = observe ? workMergeObservationCheckName : gateName;
  const expected = [...ciChecks, [expectedGateName, grant.gateAppId] as const];
  const ruleset = await github<{
    readonly id: number;
    readonly enforcement: string;
    readonly target: string;
    readonly bypass_actors?: readonly unknown[];
    readonly conditions?: {
      readonly ref_name?: {
        readonly include: readonly string[];
        readonly exclude: readonly string[];
      };
    };
    readonly rules: readonly {
      readonly type: string;
      readonly parameters?: {
        readonly strict_required_status_checks_policy?: boolean;
        readonly required_status_checks?: readonly {
          readonly context: string;
          readonly integration_id: number;
        }[];
        readonly allowed_merge_methods?: readonly string[];
      };
    }[];
  }>(publisher, `${repoPath}/rulesets/${grant.rulesetId}`);
  const refs = ruleset.conditions?.ref_name;
  const statusRule = ruleset.rules?.find(
    (rule) => rule.type === "required_status_checks",
  )?.parameters;
  const methods = ruleset.rules?.find((rule) => rule.type === "pull_request")
    ?.parameters?.allowed_merge_methods;
  const repository = await github<{
    readonly id: number;
    readonly default_branch: string;
  }>(publisher, repoPath);
  const bypassActors = ruleset.bypass_actors;
  // GitHub omits this field for callers without ruleset write access. Only the
  // read-only observer can continue, and it reports that fact as unverified.
  const noBypassActors =
    Array.isArray(bypassActors) && bypassActors.length === 0;
  if (
    repository.id !== publisher.repositoryId ||
    repository.default_branch !== "main" ||
    ruleset.id !== grant.rulesetId ||
    ruleset.enforcement !== "active" ||
    ruleset.target !== "branch" ||
    (!noBypassActors && !(observe && bypassActors === undefined)) ||
    refs?.exclude.length !== 0 ||
    !refs.include.some(
      (ref) => ref === "refs/heads/main" || ref === "~DEFAULT_BRANCH",
    ) ||
    methods?.length !== 1 ||
    methods[0] !== "squash" ||
    statusRule?.strict_required_status_checks_policy !== true ||
    (observe ? ciChecks : expected).some(
      ([context, appId]) =>
        !statusRule.required_status_checks?.some(
          (check) =>
            check.context === context && check.integration_id === appId,
        ),
    )
  ) {
    return "REQUIRED_PROTECTIONS_UNVERIFIED";
  }
  // Observe checks only on the current head and GitHub's current test merge SHA.
  // If both have the same context, use the test merge SHA as GitHub does.
  const checks = new Map<string, readonly CheckRun[]>();
  for (const sha of new Set([pr.head.sha, pr.merge_commit_sha])) {
    const payload = await github<{
      readonly total_count: number;
      readonly check_runs: readonly CheckRun[];
    }>(
      publisher,
      `${repoPath}/commits/${sha}/check-runs?filter=latest&per_page=100`,
    );
    if (
      !Array.isArray(payload.check_runs) ||
      payload.total_count !== payload.check_runs.length
    ) {
      return "CHECK_INVENTORY_INCOMPLETE";
    }
    checks.set(
      sha,
      payload.check_runs.filter((check) => check.head_sha === sha),
    );
  }
  let pending = false;
  for (const [name, appId] of expected) {
    const candidates = checks
      .get(pr.merge_commit_sha)
      ?.filter((check) => check.name === name);
    const matches = candidates?.length
      ? candidates
      : checks.get(pr.head.sha)?.filter((check) => check.name === name);
    const check = matches?.[0];
    if (matches?.length !== 1 || !check || check.app?.id !== appId) {
      return `UNVERIFIED_CHECK:${name}`;
    }
    if (
      name === expectedGateName &&
      check.external_id !==
        `work:${grant.workNumber}:pr:${grant.pullNumber}:${pr.head.sha}:${pr.base.sha}`
    ) {
      return "STALE_WORK_MERGE_GATE";
    }
    if (check.status === "completed" && check.conclusion === "success") {
      continue;
    }
    if (
      mode === "auto" &&
      name !== expectedGateName &&
      ["queued", "in_progress", "pending", "waiting", "requested"].includes(
        check.status,
      ) &&
      check.conclusion === null
    ) {
      pending = true;
      continue;
    }
    return `CHECK_NOT_SUCCESSFUL:${name}`;
  }
  if (mode === "auto" && !pending) {
    return "DIRECT_MERGE_REQUIRED";
  }
  return { bypassActors: noBypassActors ? "none" : "unverified" };
}

export async function publishWorkMerge(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  mode: MergeMode,
): Promise<WorkMergeOutcome> {
  return evaluateWorkMergeRequest(publisher, candidate, mode, false);
}

export async function observeWorkMerge(
  publisher: Omit<WorkMergePublisher, "withinVerifiedBoundary" | "mergeToken">,
  candidate: MergeCandidate,
  mode: MergeMode,
): Promise<WorkMergeOutcome> {
  return evaluateWorkMergeRequest(
    { ...publisher, mergeToken: "", withinVerifiedBoundary: async () => null },
    candidate,
    mode,
    true,
  );
}

async function evaluateWorkMergeRequest(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  mode: MergeMode,
  observe: boolean,
): Promise<WorkMergeOutcome> {
  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(publisher.repository) ||
    !positiveId(publisher.actorId) ||
    !positiveId(publisher.repositoryId) ||
    !positiveId(candidate.workNumber) ||
    !positiveId(candidate.pullNumber) ||
    !oid.test(candidate.headSha) ||
    !oid.test(candidate.baseSha)
  ) {
    return blocked("INVALID_REQUEST");
  }

  const repoPath = `/repos/${publisher.repository}`;
  const prPath = `${repoPath}/pulls/${candidate.pullNumber}`;
  if (
    !observe &&
    (!publisher.mergeToken.trim() ||
      publisher.mergeToken === publisher.repositoryToken)
  ) {
    return blocked("ISOLATED_MERGE_CREDENTIAL_REQUIRED");
  }
  try {
    if (!authorized(await publisher.readGrant(), publisher, candidate, mode)) {
      return blocked("MERGE_NOT_DELEGATED");
    }
    const evaluate = async (): Promise<WorkMergeOutcome> => {
      const grant = structuredClone(await publisher.readGrant());
      if (!authorized(grant, publisher, candidate, mode)) {
        return blocked("MERGE_NOT_DELEGATED");
      }
      const pr = await github<PullRequest>(publisher, prPath);
      if (!sameCandidate(pr, candidate, publisher.repositoryId)) {
        return blocked("CANDIDATE_CHANGED");
      }
      if (
        pr.merged === true &&
        pr.merge_commit_sha &&
        oid.test(pr.merge_commit_sha)
      ) {
        return { status: "already-merged", sha: pr.merge_commit_sha };
      }
      if (
        pr.state !== "open" ||
        pr.draft !== false ||
        pr.merged !== false ||
        pr.base.sha !== candidate.baseSha
      ) {
        return blocked("CANDIDATE_CHANGED");
      }

      const live = await readWorkMergeGateLiveEvidence({
        ...publisher,
        workNumber: candidate.workNumber,
      });
      if (live.status !== "ready") {
        return blocked(live.reason);
      }
      if (
        live.workState !== "Validating" ||
        !live.dependenciesResolved ||
        !live.pullRequestMergeable ||
        live.target.pullRequestNumber !== candidate.pullNumber ||
        live.target.headSha !== candidate.headSha ||
        live.baseSha !== candidate.baseSha
      ) {
        return blocked("WORK_NOT_ELIGIBLE");
      }
      const evidenceFailure = await verifyEvidence(
        publisher,
        candidate,
        grant,
        repoPath,
      );
      if (evidenceFailure) {
        return blocked(evidenceFailure);
      }
      const checks = await verifyChecks(
        publisher,
        grant,
        repoPath,
        pr,
        mode,
        observe,
      );
      if (typeof checks === "string") {
        return blocked(checks);
      }

      const current = await github<PullRequest>(publisher, prPath);
      if (
        !sameCandidate(current, candidate, publisher.repositoryId) ||
        current.base.sha !== candidate.baseSha ||
        current.state !== "open" ||
        current.draft !== false ||
        current.merged !== false ||
        current.merge_commit_sha !== pr.merge_commit_sha
      ) {
        return blocked("CANDIDATE_CHANGED");
      }
      const currentGrant = await publisher.readGrant();
      if (!isDeepStrictEqual(currentGrant, grant)) {
        return blocked("MERGE_DELEGATION_CHANGED");
      }
      // An existing request may have been armed for another candidate.
      if (current.auto_merge !== null) {
        return blocked("EXISTING_AUTO_MERGE_REQUEST");
      }
      const headline = await safeSquashHeadline(publisher, current);
      if (!headline) {
        return blocked("NATIVE_ISSUE_CLOSURE_UNVERIFIED");
      }
      const message = `Refs #${candidate.workNumber}`;
      if (observe) {
        return {
          status: "observed-checks-passed",
          bypassActors: checks.bypassActors,
        };
      }

      try {
        if (mode === "direct") {
          const merged = await github<{
            readonly merged: boolean;
            readonly sha: string;
          }>(
            publisher,
            `${prPath}/merge`,
            "PUT",
            {
              sha: candidate.headSha,
              merge_method: "squash",
              commit_title: headline,
              commit_message: message,
            },
            publisher.mergeToken,
          );
          if (merged.merged === true && oid.test(merged.sha)) {
            return { status: "merged", sha: merged.sha };
          }
        } else {
          const armed = await github<{
            readonly data?: {
              readonly enablePullRequestAutoMerge?: {
                readonly pullRequest?: {
                  readonly id: string;
                  readonly autoMergeRequest?: object | null;
                };
              };
            };
            readonly errors?: readonly unknown[];
          }>(
            publisher,
            "/graphql",
            "POST",
            {
              query: `mutation($input: EnablePullRequestAutoMergeInput!) {
              enablePullRequestAutoMerge(input: $input) { pullRequest { id autoMergeRequest { enabledAt } } }
            }`,
              variables: {
                input: {
                  pullRequestId: current.node_id,
                  expectedHeadOid: candidate.headSha,
                  mergeMethod: "SQUASH",
                  commitHeadline: headline,
                  commitBody: message,
                },
              },
            },
            publisher.mergeToken,
          );
          const armedPr = armed.data?.enablePullRequestAutoMerge?.pullRequest;
          if (
            !armed.errors?.length &&
            armedPr?.id === current.node_id &&
            armedPr.autoMergeRequest
          ) {
            return { status: "auto-merge-requested" };
          }
        }
      } catch {
        // A failed response can arrive after GitHub has accepted the mutation.
      }
      const observed = await github<PullRequest>(publisher, prPath).catch(
        () => null,
      );
      if (
        observed &&
        sameCandidate(observed, candidate, publisher.repositoryId) &&
        observed.merged === true &&
        observed.merge_commit_sha &&
        oid.test(observed.merge_commit_sha)
      ) {
        return { status: "merged", sha: observed.merge_commit_sha };
      }
      return { status: "uncertain", reason: "MUTATION_NOT_CONFIRMED" };
    };
    const result = observe
      ? await evaluate()
      : await publisher.withinVerifiedBoundary(candidate, mode, evaluate);
    return result ?? blocked("FRESHNESS_BOUNDARY_UNVERIFIED");
  } catch {
    return blocked("TRUSTED_EVIDENCE_UNAVAILABLE");
  }
}
