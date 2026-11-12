import { isDeepStrictEqual } from "node:util";

import type { MergeReservation } from "../control/merge-reservation.js";
import {
  evaluateWorkMergeGate,
  workMergeObservationCheckName,
  workMergeRequiredCheckName,
} from "../control/work-merge-gate.js";
import { readWorkMergeGateLiveEvidence } from "./gate-live-evidence.js";
import type { OperationalOwnerActivation } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import { matchesCompletedCandidate } from "./work-completion-evidence.js";

const gateName = workMergeRequiredCheckName;
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

export type WorkGateEvaluationGrant = Omit<WorkMergeGrant, "direct" | "auto"> &
  MergeCandidate & {
    readonly purpose: "evaluate-work-merge-gate";
    readonly expiresAt: string;
    readonly requiredEvidence: readonly EvidenceReference["kind"][];
  };

interface PullRequest {
  readonly node_id: string;
  readonly title: string;
  readonly body: string | null;
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
  readonly id: number;
  readonly name: string;
  readonly head_sha: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly external_id: string | null;
  readonly app: { readonly id: number } | null;
  readonly started_at?: string | null;
}

interface IssueComment {
  readonly id: number;
  readonly issue_url: string;
  readonly body: string;
  readonly user: { readonly id: number; readonly type: string } | null;
  readonly performed_via_github_app?: object | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

type MergeMode = "direct" | "auto";

interface ReservedGateCheck {
  readonly checkId: number;
  readonly reservationId: string;
}

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

type WorkMergeReader = Omit<
  WorkMergePublisher,
  "withinVerifiedBoundary" | "mergeToken"
>;
type WorkGateReader = Omit<WorkMergeReader, "readGrant">;

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
  publisher: Pick<WorkMergeReader, "repositoryToken" | "fetchImpl">,
  path: string,
  method = "GET",
  body?: object,
  token = publisher.repositoryToken,
  expectedStatus?: number,
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
  if (
    !response.ok ||
    (expectedStatus !== undefined && response.status !== expectedStatus)
  ) {
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
  publisher: WorkMergeReader,
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
  publisher: WorkGateReader,
  candidate: MergeCandidate,
  grant: Pick<WorkMergeGrant, "evidence" | "requiredTasks">,
  repoPath: string,
  exactTasks = false,
  requireUnedited = false,
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
      (requireUnedited &&
        (!comment.created_at || comment.created_at !== comment.updated_at)) ||
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
    (exactTasks && tasks.length !== grant.requiredTasks.length) ||
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
  publisher: WorkGateReader,
  grant: Pick<
    WorkMergeGrant,
    "gateAppId" | "rulesetId" | "workNumber" | "pullNumber"
  >,
  repoPath: string,
  pr: PullRequest,
  mode: MergeMode,
  observe: boolean,
  evaluateGate = false,
  reservedCheck?: ReservedGateCheck,
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
  const expected = evaluateGate
    ? ciChecks
    : [...ciChecks, [expectedGateName, grant.gateAppId] as const];
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
    (evaluateGate
      ? [...ciChecks, [gateName, grant.gateAppId] as const]
      : observe
        ? ciChecks
        : expected
    ).some(
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
    if (!matches?.length || matches.some((check) => check.app?.id !== appId)) {
      return `UNVERIFIED_CHECK:${name}`;
    }
    let check = matches[0];
    if (matches.length > 1) {
      // The PR workflow can cancel a Draft run and start a new suite for the
      // same head when it becomes ready. GitHub lists both as latest per suite.
      if (!evaluateGate) {
        return `UNVERIFIED_CHECK:${name}`;
      }
      const attempts = matches.map((run) => ({
        run,
        started: Date.parse(run.started_at ?? ""),
      }));
      attempts.sort((a, b) => b.started - a.started);
      if (
        attempts.some(({ started }) => !Number.isFinite(started)) ||
        attempts[0]?.started === attempts[1]?.started
      ) {
        return `UNVERIFIED_CHECK:${name}`;
      }
      check = attempts[0]?.run;
    }
    if (!check) {
      return `UNVERIFIED_CHECK:${name}`;
    }
    if (reservedCheck && name === expectedGateName) {
      if (
        check.id !== reservedCheck.checkId ||
        check.external_id !== reservedCheck.reservationId ||
        check.head_sha !== pr.head.sha ||
        check.status !== "queued" ||
        check.conclusion !== null
      ) {
        return "RESERVED_WORK_MERGE_GATE_UNVERIFIED";
      }
      pending = true;
      continue;
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
      !reservedCheck &&
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

// Called only within the protected controller's durable arm intent.
export async function armReservedWorkSquash(
  publisher: WorkMergePublisher,
  reservation: MergeReservation,
  reservationId: string,
): Promise<WorkMergeOutcome> {
  const { candidate, state } = reservation;
  if (
    state.phase !== "pending" ||
    state.operation !== "arm-squash" ||
    state.checkId === undefined ||
    !positiveId(state.checkId) ||
    !reservationId.trim()
  ) {
    return blocked("RESERVED_WORK_MERGE_GATE_UNVERIFIED");
  }
  return evaluateWorkMergeRequest(publisher, candidate, "auto", false, {
    checkId: state.checkId,
    reservationId,
  });
}

export async function observeReservedWorkSquash(
  reader: Pick<
    WorkMergeReader,
    "repository" | "repositoryId" | "repositoryToken" | "fetchImpl"
  >,
  candidate: MergeCandidate,
): Promise<{ readonly kind: "squash-merged"; readonly sha: string } | null> {
  if (
    !/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/iu.test(reader.repository) ||
    /\/\.{1,2}$/u.test(reader.repository) ||
    !positiveId(candidate.pullNumber)
  ) {
    return null;
  }
  const repo = `/repos/${reader.repository}`;
  try {
    const pr = await github<PullRequest>(
      reader,
      `${repo}/pulls/${candidate.pullNumber}`,
    );
    const sha = pr.merge_commit_sha;
    if (
      !sameCandidate(pr, candidate, reader.repositoryId) ||
      pr.merged !== true ||
      !sha ||
      !oid.test(sha)
    ) {
      return null;
    }

    const [commit, comparison] = await Promise.all([
      github<Parameters<typeof matchesCompletedCandidate>[2]>(
        reader,
        `${repo}/commits/${sha}`,
      ),
      github<Parameters<typeof matchesCompletedCandidate>[3]>(
        reader,
        `${repo}/compare/${sha}...main`,
      ),
    ]);
    return matchesCompletedCandidate(
      { ...candidate, mergeSha: sha },
      { ...pr, merge_commit_sha: sha },
      commit,
      comparison,
      reader.repositoryId,
    )
      ? { kind: "squash-merged", sha }
      : null;
  } catch {
    return null;
  }
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

// The protected authorization identifies applicable evidence for one exact
// candidate. It grants evaluation only and cannot be used as a merge grant.
export async function evaluateScopedWorkGate(
  reader: WorkGateReader & {
    readonly readGrant: () => Promise<WorkGateEvaluationGrant | null>;
  },
  candidate: MergeCandidate,
) {
  const grant = await reader.readGrant();
  const mandatory = ["code-review", "validation", "working-decisions"];
  const supported = new Set([
    ...mandatory,
    "architecture-review",
    "functional-review",
    "specialist-review",
    "functional-approval",
    "governance-approval",
    "adr-approval",
  ]);
  if (
    grant?.purpose !== "evaluate-work-merge-gate" ||
    "direct" in grant ||
    "auto" in grant ||
    grant.actorId !== reader.actorId ||
    grant.repositoryId !== reader.repositoryId ||
    grant.workNumber !== candidate.workNumber ||
    grant.pullNumber !== candidate.pullNumber ||
    grant.headSha !== candidate.headSha ||
    grant.baseSha !== candidate.baseSha ||
    !oid.test(candidate.headSha) ||
    !oid.test(candidate.baseSha) ||
    !(Date.parse(grant.expiresAt) > Date.now()) ||
    grant.gateAppId !== 5625775 ||
    !Array.isArray(grant.requiredEvidence) ||
    !Array.isArray(grant.evidence) ||
    !Array.isArray(grant.requiredTasks) ||
    new Set(grant.requiredTasks).size !== grant.requiredTasks.length ||
    !grant.requiredTasks.every(positiveId) ||
    !mandatory.every((kind) =>
      grant.requiredEvidence.some((value) => value === kind),
    ) ||
    new Set(grant.requiredEvidence).size !== grant.requiredEvidence.length ||
    !grant.requiredEvidence.every((kind) => supported.has(kind)) ||
    grant.requiredEvidence.length !== grant.evidence.length ||
    !grant.requiredEvidence.every((kind) =>
      grant.evidence.some((reference) => reference?.kind === kind),
    )
  ) {
    throw new Error("EVALUATED_GATE_NOT_AUTHORIZED");
  }
  const repo = `/repos/${reader.repository}`;
  const pr = await github<PullRequest>(
    reader,
    `${repo}/pulls/${candidate.pullNumber}`,
  );
  if (
    !sameCandidate(pr, candidate, reader.repositoryId) ||
    pr.state !== "open" ||
    pr.draft !== false ||
    pr.merged !== false ||
    pr.base.sha !== candidate.baseSha
  ) {
    throw new Error("CANDIDATE_CHANGED");
  }
  const live = await readWorkMergeGateLiveEvidence({
    ...reader,
    workNumber: candidate.workNumber,
  });
  if (live.status !== "ready") {
    throw new Error(live.reason);
  }
  if (
    live.target.pullRequestNumber !== candidate.pullNumber ||
    live.target.headSha !== candidate.headSha ||
    live.baseSha !== candidate.baseSha
  ) {
    throw new Error("WORK_INTEGRATION_PR_UNVERIFIED");
  }
  const evidence = await verifyEvidence(
    reader,
    candidate,
    grant,
    repo,
    true,
    true,
  );
  if (evidence && evidence !== "REQUIRED_TASKS_UNRESOLVED") {
    throw new Error(evidence);
  }
  const checks = await verifyChecks(
    reader,
    grant,
    repo,
    pr,
    "direct",
    true,
    true,
  );
  if (
    checks === "REQUIRED_PROTECTIONS_UNVERIFIED" ||
    checks === "CHECK_CANDIDATE_UNAVAILABLE" ||
    checks === "CHECK_INVENTORY_INCOMPLETE"
  ) {
    throw new Error(checks);
  }
  return evaluateWorkMergeGate({
    workIdentified: true,
    workState: live.workState,
    requiredTasksAcceptable: evidence === null,
    dependenciesResolved: live.dependenciesResolved,
    applicableReviewsAccepted: true,
    validationSufficient: typeof checks !== "string",
    priorAuthorityGatesSatisfied: true,
    workingDecisionsResolved: true,
    repositoryChecksSatisfied: typeof checks !== "string",
    pullRequestMergeable: live.pullRequestMergeable,
    enforcement: "unavailable",
  });
}

async function evaluateWorkMergeRequest(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  mode: MergeMode,
  observe: boolean,
  reservedCheck?: ReservedGateCheck,
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
        if (reservedCheck) {
          const merged = await observeReservedWorkSquash(publisher, candidate);
          return merged
            ? { status: "already-merged", sha: merged.sha }
            : blocked("RESERVED_SQUASH_OUTCOME_UNVERIFIED");
        }
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
        false,
        reservedCheck,
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
          // Only a new, confirmed create authorizes a squash attempt. A lost
          // response consumes the candidate without authorizing an API retry.
          const ref = `refs/tags/delivery-direct/work-${candidate.workNumber}-pr-${candidate.pullNumber}/${candidate.headSha}-${candidate.baseSha}`;
          try {
            const receipt = await github<{
              readonly ref: string;
              readonly object: { readonly sha: string; readonly type: string };
            }>(
              publisher,
              `${repoPath}/git/refs`,
              "POST",
              { ref, sha: candidate.headSha },
              publisher.mergeToken,
              201,
            );
            if (
              receipt.ref !== ref ||
              receipt.object?.type !== "commit" ||
              receipt.object.sha !== candidate.headSha
            ) {
              return blocked("DIRECT_REQUEST_CONSUMPTION_UNCONFIRMED");
            }
          } catch {
            return blocked("DIRECT_REQUEST_CONSUMPTION_UNCONFIRMED");
          }
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
      if (reservedCheck) {
        const merged = await observeReservedWorkSquash(publisher, candidate);
        return merged
          ? { status: "merged", sha: merged.sha }
          : { status: "uncertain", reason: "MUTATION_NOT_CONFIRMED" };
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
