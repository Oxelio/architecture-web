import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { MergeReservation } from "../control/merge-reservation.js";
import { sameWorkIntegrationCandidate } from "../control/work-integration-request.js";
import {
  evaluateWorkMergeGate,
  workMergeObservationCheckName,
  workMergeRequiredCheckName,
} from "../control/work-merge-gate.js";
import { completeReservedGateCheck } from "./gate-check-publisher.js";
import { readWorkMergeGateLiveEvidence } from "./gate-live-evidence.js";
import type { OperationalOwnerActivation } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";
import type { AcceptedStandingImpact } from "./standing-work-eligibility.js";
import { matchesCompletedCandidate } from "./work-completion-evidence.js";
import { workReference } from "./work-reference.js";

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
  readonly auto_merge: {
    readonly merge_method?: string;
    readonly enabled_by?: {
      readonly id?: number;
      readonly type?: string;
    } | null;
  } | null;
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
  readonly authorizeArm?: () => Promise<boolean>;
  readonly release?: {
    readonly checksToken: string;
    readonly controllerBotId: number;
    readonly admit: (digest: string) => Promise<number | null>;
  };
}

interface GateRuleset {
  readonly id: number;
  readonly enforcement: string;
  readonly target: string;
  readonly updated_at?: string;
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
}

export interface StandingRulesetObservation {
  readonly repositoryId: number;
  readonly rulesetId: number;
  readonly updatedAt: string;
  readonly enforcement: string;
  readonly target: string;
  readonly conditions: GateRuleset["conditions"];
  readonly rules: GateRuleset["rules"];
  readonly bypassActors: readonly unknown[];
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
  // Independent administrative evidence of the effective ruleset from Validation.
  readonly readStandingRulesetObservation?: (
    rulesetId: number,
  ) => Promise<StandingRulesetObservation | null>;
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
  | { readonly status: "gate-released"; readonly checkId: number }
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

function hasClosingIssueReference(title: string): boolean {
  const verbs = /\b(?:clos(?:es|ed|e)|fix(?:es|ed)?|resolv(?:es|ed|e))\b/giu;
  const issue = /^(?:[\w.-]+\/[\w.-]+)?#\d+/iu;
  const url = /^https?:\/\//iu;
  for (const match of title.matchAll(verbs)) {
    const suffix = title.slice(match.index + match[0].length);
    const whitespace = /^\s*/u.exec(suffix)?.[0] ?? "";
    const next = suffix.slice(whitespace.length);
    let reference: string;
    if (next.startsWith(":")) {
      const afterColon = next.slice(1);
      const requiredSpace = /^\s+/u.exec(afterColon)?.[0];
      if (!requiredSpace) {
        continue;
      }
      reference = afterColon.slice(requiredSpace.length);
    } else {
      if (!whitespace) {
        continue;
      }
      reference = next;
    }
    if (issue.test(reference) || url.test(reference)) {
      return true;
    }
  }
  return false;
}

async function safeSquashHeadline(
  publisher: WorkMergePublisher,
  pr: PullRequest,
): Promise<string | null> {
  if (!pr.title?.trim() || hasClosingIssueReference(pr.title)) {
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

export type StandingEvidenceAuthority = Readonly<
  Partial<
    Record<
      EvidenceReference["kind"],
      readonly {
        readonly authorId: number;
        readonly appId: number | null;
      }[]
    >
  >
>;

// Supplied by the protected environment from the applicable Method route.
// A PR event or evidence comment cannot choose which roles are required.
function isStandingGrantCandidate(
  publisher: Pick<WorkGateReader, "repository" | "repositoryId" | "actorId">,
  candidate: MergeCandidate,
  input: { readonly gateAppId: number; readonly rulesetId: number },
): boolean {
  return (
    publisher.repository.toLowerCase() === "oxelio/architecture-web" &&
    publisher.repositoryId === 1336937640 &&
    positiveId(publisher.actorId) &&
    positiveId(candidate.workNumber) &&
    positiveId(candidate.pullNumber) &&
    candidate.workNumber !== candidate.pullNumber &&
    oid.test(candidate.headSha) &&
    oid.test(candidate.baseSha) &&
    positiveId(input.gateAppId) &&
    positiveId(input.rulesetId)
  );
}

export async function discoverStandingWorkMergeGrant(
  publisher: Pick<
    WorkGateReader,
    "repository" | "repositoryId" | "repositoryToken" | "actorId" | "fetchImpl"
  >,
  candidate: MergeCandidate,
  input: {
    readonly gateAppId: number;
    readonly rulesetId: number;
    readonly authority: StandingEvidenceAuthority;
  },
): Promise<WorkMergeGrant | null> {
  if (!isStandingGrantCandidate(publisher, candidate, input)) {
    return null;
  }
  const kinds = [
    "code-review",
    "architecture-review",
    "functional-review",
    "specialist-review",
    "validation",
    "working-decisions",
    "functional-approval",
    "governance-approval",
    "adr-approval",
  ] as const;
  const required = kinds.filter((kind) => Object.hasOwn(input.authority, kind));
  if (
    Object.keys(input.authority).length !== required.length ||
    !required.includes("code-review") ||
    !required.includes("validation") ||
    !required.includes("working-decisions")
  ) {
    return null;
  }

  const repoPath = `/repos/${publisher.repository}`;
  const issuePath = `${repoPath}/issues`;
  try {
    const [workComments, pullComments, tasks] = await Promise.all([
      github<readonly IssueComment[]>(
        publisher,
        `${issuePath}/${candidate.workNumber}/comments?per_page=100`,
      ),
      github<readonly IssueComment[]>(
        publisher,
        `${issuePath}/${candidate.pullNumber}/comments?per_page=100`,
      ),
      github<
        readonly {
          readonly number: number;
          readonly repository_url: string;
          readonly state: string;
          readonly state_reason: string | null;
        }[]
      >(
        publisher,
        `${issuePath}/${candidate.workNumber}/sub_issues?per_page=100`,
      ),
    ]);
    if (
      [workComments, pullComments, tasks].some(
        (list) => !Array.isArray(list) || list.length >= 100,
      )
    ) {
      return null;
    }
    const prefix = `https://api.github.com${repoPath.toLowerCase()}`;
    const requiredTasks = tasks.map(
      ({ number, repository_url, state, state_reason }) =>
        positiveId(number) &&
        repository_url?.toLowerCase() === prefix &&
        state === "closed" &&
        state_reason === "completed"
          ? number
          : 0,
    );
    if (
      requiredTasks.includes(0) ||
      new Set(requiredTasks).size !== requiredTasks.length
    ) {
      return null;
    }

    const selected = new Map<EvidenceReference["kind"], EvidenceReference>();
    for (const comment of [...workComments, ...pullComments]) {
      if (!comment.user || !positiveId(comment.user.id)) {
        continue;
      }
      const record = parseEvidenceComment(comment.body);
      const kind = required.find((entry) => entry === record?.["kind"]);
      if (
        !kind ||
        !record ||
        !sameWorkIntegrationCandidate(candidate, record)
      ) {
        continue;
      }
      const app = comment.performed_via_github_app;
      let appId: unknown;
      if (app === null) {
        appId = null;
      } else if (app && "id" in app) {
        appId = app.id;
      }
      const authorId = comment.user.id;
      if (
        !input.authority[kind]?.some(
          (authority) =>
            authority.authorId === authorId && authority.appId === appId,
        )
      ) {
        continue;
      }
      const issueUrl = comment.issue_url?.toLowerCase();
      if (
        !positiveId(comment.id) ||
        (issueUrl !== `${prefix}/issues/${candidate.workNumber}` &&
          issueUrl !== `${prefix}/issues/${candidate.pullNumber}`) ||
        !comment.created_at ||
        comment.created_at !== comment.updated_at ||
        record["decision"] !== "accepted" ||
        (kind.endsWith("-approval") &&
          (comment.user.type !== "User" || appId !== null)) ||
        selected.has(kind)
      ) {
        return null;
      }
      selected.set(kind, { kind, commentId: comment.id, authorId });
    }
    if (selected.size !== required.length) {
      return null;
    }
    return {
      actorId: publisher.actorId,
      repositoryId: publisher.repositoryId,
      workNumber: candidate.workNumber,
      pullNumber: candidate.pullNumber,
      direct: false,
      auto: true,
      gateAppId: input.gateAppId,
      rulesetId: input.rulesetId,
      evidence: [...selected.values()].sort((left, right) =>
        left.kind.localeCompare(right.kind, "en"),
      ),
      requiredTasks: requiredTasks.toSorted((left, right) => left - right),
    };
  } catch {
    return null;
  }
}

function parseEvidenceComment(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function validEvidenceComment(
  comment: IssueComment,
  reference: EvidenceReference,
  candidate: MergeCandidate,
  repoPath: string,
  requireUnedited: boolean,
): boolean {
  const issueUrl = comment.issue_url?.toLowerCase();
  const prefix = `https://api.github.com${repoPath.toLowerCase()}/issues/`;
  return (
    comment.id === reference.commentId &&
    comment.user?.id === reference.authorId &&
    (issueUrl === `${prefix}${candidate.workNumber}` ||
      issueUrl === `${prefix}${candidate.pullNumber}`) &&
    (!requireUnedited ||
      (Boolean(comment.created_at) &&
        comment.created_at === comment.updated_at)) &&
    (!reference.kind.endsWith("-approval") ||
      (comment.user.type === "User" &&
        comment.performed_via_github_app === null))
  );
}

async function verifyEvidence(
  publisher: WorkGateReader,
  candidate: MergeCandidate,
  grant: Pick<WorkMergeGrant, "evidence" | "requiredTasks">,
  repoPath: string,
  exactTasks = false,
  requireUnedited = false,
  verifiedReview?: (record: Record<string, unknown>) => void,
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
    if (
      !validEvidenceComment(
        comment,
        reference,
        candidate,
        repoPath,
        requireUnedited,
      )
    ) {
      return `UNVERIFIED_EVIDENCE:${reference.kind}`;
    }
    const record = parseEvidenceComment(comment.body);
    if (!record) {
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
    if (reference.kind === "code-review") {
      verifiedReview?.(record);
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

// Read the impact assessment only from the same candidate-bound review
// records used by the Work Merge Gate. Their reference and authority are
// resolved by the trusted publisher, never by the event that woke it.
export async function readAcceptedStandingImpact(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
): Promise<AcceptedStandingImpact | null> {
  try {
    if (publisher.repository.toLowerCase() !== "oxelio/architecture-web") {
      return null;
    }
    const grant = structuredClone(await publisher.readGrant());
    if (
      !authorized(grant, publisher, candidate, "auto") ||
      !grant.evidence.some(({ kind }) => kind === "validation") ||
      new Set(grant.requiredTasks).size !== grant.requiredTasks.length ||
      !grant.requiredTasks.every(positiveId)
    ) {
      return null;
    }

    const reviews: AcceptedStandingImpact[] = [];
    const failure = await verifyEvidence(
      publisher,
      candidate,
      grant,
      `/repos/${publisher.repository}`,
      true,
      true,
      (record) => {
        const disposition = record["standingImpact"];
        const factsDigest = record["standingFactsDigest"];
        if (
          (disposition === "ordinary" || disposition === "manual") &&
          typeof factsDigest === "string" &&
          /^[0-9a-f]{64}$/u.test(factsDigest)
        ) {
          reviews.push({ candidate, factsDigest, disposition });
        }
      },
    );
    return failure || !isDeepStrictEqual(grant, await publisher.readGrant())
      ? null
      : (reviews[0] ?? null);
  } catch {
    return null;
  }
}

async function readObservedRulesetBypassActors(
  publisher: Pick<
    WorkGateReader,
    "repositoryId" | "readStandingRulesetObservation"
  >,
  ruleset: GateRuleset,
): Promise<readonly unknown[] | null> {
  const evidence = await publisher.readStandingRulesetObservation?.(ruleset.id);
  return !!evidence &&
    evidence.repositoryId === publisher.repositoryId &&
    evidence.rulesetId === ruleset.id &&
    !!ruleset.updated_at &&
    evidence.updatedAt === ruleset.updated_at &&
    evidence.enforcement === ruleset.enforcement &&
    evidence.target === ruleset.target &&
    isDeepStrictEqual(evidence.conditions, ruleset.conditions) &&
    isDeepStrictEqual(evidence.rules, ruleset.rules) &&
    Array.isArray(evidence.bypassActors)
    ? evidence.bypassActors
    : null;
}

export async function verifyStandingJournalRules(
  publisher: Pick<
    WorkGateReader,
    | "repository"
    | "repositoryId"
    | "repositoryToken"
    | "fetchImpl"
    | "readStandingRulesetObservation"
  >,
  expected: {
    readonly creationRulesetId: number;
    readonly immutabilityRulesetId: number;
    readonly controllerAppId: number;
  },
): Promise<boolean> {
  if (
    publisher.repository !== "Oxelio/architecture-web" ||
    publisher.repositoryId !== 1336937640 ||
    !positiveId(expected.creationRulesetId) ||
    !positiveId(expected.immutabilityRulesetId) ||
    expected.creationRulesetId === expected.immutabilityRulesetId ||
    !positiveId(expected.controllerAppId)
  ) {
    return false;
  }

  const rulesMatch = async (id: number, expectedRules: readonly string[]) => {
    const ruleset = await github<GateRuleset>(
      publisher,
      `/repos/${publisher.repository}/rulesets/${id}`,
    );
    const refs = ruleset?.conditions?.ref_name;
    if (
      ruleset?.id !== id ||
      ruleset.target !== "tag" ||
      ruleset.enforcement !== "active" ||
      !isDeepStrictEqual(refs?.include, [
        "refs/tags/delivery-control/r*",
        "refs/tags/delivery-control/disabled-*",
        "refs/tags/delivery-control/status-*",
      ]) ||
      !isDeepStrictEqual(refs?.exclude, []) ||
      !Array.isArray(ruleset.rules) ||
      ruleset.rules.length !== expectedRules.length ||
      !expectedRules.every((type) =>
        ruleset.rules.some((rule) => rule.type === type),
      )
    ) {
      return null;
    }
    if (ruleset.bypass_actors !== undefined) {
      return ruleset.bypass_actors;
    }
    return readObservedRulesetBypassActors(publisher, ruleset);
  };

  try {
    const [createBypass, modifyBypass] = await Promise.all([
      rulesMatch(expected.creationRulesetId, ["creation"]),
      rulesMatch(expected.immutabilityRulesetId, ["update", "deletion"]),
    ]);
    return (
      Array.isArray(createBypass) &&
      createBypass.length === 1 &&
      isDeepStrictEqual(createBypass[0], {
        actor_id: expected.controllerAppId,
        actor_type: "Integration",
        bypass_mode: "always",
      }) &&
      Array.isArray(modifyBypass) &&
      modifyBypass.length === 0
    );
  } catch {
    return false;
  }
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
  options: {
    readonly evaluateGate?: boolean;
    readonly reservedCheck?: ReservedGateCheck;
  } = {},
): Promise<string | { readonly bypassActors: "none" | "unverified" }> {
  const { evaluateGate = false, reservedCheck } = options;
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
  let checksForMode: readonly (readonly [string, number])[] = expected;
  if (evaluateGate) {
    checksForMode = [...ciChecks, [gateName, grant.gateAppId] as const];
  } else if (observe) {
    checksForMode = ciChecks;
  }
  const ruleset = await github<GateRuleset>(
    publisher,
    `${repoPath}/rulesets/${grant.rulesetId}`,
  );
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
  // For the reserved path, the independently verified administrative view
  // can supply the omitted field. A contradictory live response always wins.
  const noBypassActors =
    bypassActors === undefined && reservedCheck
      ? (await readObservedRulesetBypassActors(publisher, ruleset))?.length ===
        0
      : Array.isArray(bypassActors) && bypassActors.length === 0;
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
    checksForMode.some(
      ([context, appId]) =>
        !statusRule.required_status_checks?.some(
          (check) =>
            check.context === context && check.integration_id === appId,
        ),
    )
  ) {
    return "REQUIRED_PROTECTIONS_UNVERIFIED";
  }
  if (reservedCheck) {
    // The latest-per-suite view does not prove that the held check is
    // the only candidate for this required context.
    const shas = [...new Set([pr.head.sha, pr.merge_commit_sha])];
    const inventories = await Promise.all(
      shas.map((sha) =>
        github<{
          readonly total_count: number;
          readonly check_runs: readonly CheckRun[];
        }>(
          publisher,
          `${repoPath}/commits/${sha}/check-runs?check_name=${encodeURIComponent(gateName)}&filter=all&per_page=100`,
        ),
      ),
    );
    const matches: CheckRun[] = [];
    for (const [index, inventory] of inventories.entries()) {
      if (
        !Array.isArray(inventory.check_runs) ||
        inventory.total_count !== inventory.check_runs.length ||
        inventory.total_count >= 100 ||
        inventory.check_runs.some(
          (check) => check.name !== gateName || check.head_sha !== shas[index],
        )
      ) {
        return "RESERVED_GATE_INVENTORY_UNVERIFIED";
      }
      matches.push(...inventory.check_runs);
    }
    const [check] = matches;
    if (
      matches.length !== 1 ||
      check?.id !== reservedCheck.checkId ||
      check.app?.id !== grant.gateAppId ||
      check.external_id !== reservedCheck.reservationId ||
      check.head_sha !== pr.head.sha ||
      check.status !== "queued" ||
      check.conclusion !== null
    ) {
      return "RESERVED_WORK_MERGE_GATE_UNVERIFIED";
    }
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
  authorizeArm: () => Promise<boolean>,
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
    authorizeArm,
  });
}

export async function releaseReservedWorkMergeGate(
  publisher: WorkMergePublisher,
  reservation: MergeReservation,
  reservationId: string,
  checksToken: string,
  controllerBotId: number,
  admit: (digest: string) => Promise<number | null>,
): Promise<WorkMergeOutcome> {
  const { candidate, state } = reservation;
  if (
    state.phase !== "pending" ||
    state.operation !== "release-check" ||
    state.releaseAdmission !== undefined ||
    state.checkId === undefined ||
    !positiveId(state.checkId) ||
    !reservationId.trim() ||
    !checksToken.trim() ||
    [
      publisher.repositoryToken,
      publisher.projectsToken,
      publisher.mergeToken,
    ].includes(checksToken) ||
    !positiveId(controllerBotId)
  ) {
    return blocked("RESERVED_WORK_MERGE_GATE_UNVERIFIED");
  }
  return evaluateWorkMergeRequest(publisher, candidate, "auto", false, {
    checkId: state.checkId,
    reservationId,
    release: { checksToken, controllerBotId, admit },
  });
}

function isNativeSquashFrom(pr: PullRequest, controllerBotId: number): boolean {
  return (
    pr.auto_merge?.merge_method === "squash" &&
    pr.auto_merge.enabled_by?.type === "Bot" &&
    pr.auto_merge.enabled_by.id === controllerBotId
  );
}

export async function observeReservedNativeArm(
  publisher: WorkMergePublisher,
  candidate: MergeCandidate,
  controllerBotId: number,
): Promise<boolean> {
  if (
    publisher.repository.toLowerCase() !== "oxelio/architecture-web" ||
    !positiveId(candidate.pullNumber) ||
    !positiveId(controllerBotId)
  ) {
    return false;
  }
  try {
    const current = await github<PullRequest>(
      publisher,
      `/repos/${publisher.repository}/pulls/${candidate.pullNumber}`,
    );
    return (
      sameCandidate(current, candidate, publisher.repositoryId) &&
      current.state === "open" &&
      current.draft === false &&
      current.merged === false &&
      current.base.sha === candidate.baseSha &&
      workReference(current.body) === candidate.workNumber &&
      isNativeSquashFrom(current, controllerBotId)
    );
  } catch {
    return false;
  }
}

export async function cancelReservedNativeSquash(
  publisher: WorkMergePublisher,
  reservation: MergeReservation,
  scope: {
    readonly reservationId: string;
    readonly controllerBotId: number;
    readonly checksAppId: number;
    readonly rulesetId: number;
  },
): Promise<
  | { readonly kind: "squash-cancelled" }
  | { readonly kind: "squash-merged"; readonly sha: string }
  | null
> {
  const { candidate, state } = reservation;
  if (
    state.phase !== "pending" ||
    state.operation !== "resolve" ||
    state.previousPhase === undefined ||
    !scope.reservationId.trim() ||
    publisher.repository.toLowerCase() !== "oxelio/architecture-web" ||
    !positiveId(candidate.pullNumber) ||
    !positiveId(scope.controllerBotId) ||
    !positiveId(scope.checksAppId) ||
    !positiveId(scope.rulesetId) ||
    !publisher.mergeToken.trim() ||
    publisher.mergeToken === publisher.repositoryToken
  ) {
    return null;
  }
  const previousPhase = state.previousPhase;
  const repoPath = `/repos/${publisher.repository}`;
  const prPath = `${repoPath}/pulls/${candidate.pullNumber}`;
  const grant = {
    workNumber: candidate.workNumber,
    pullNumber: candidate.pullNumber,
    gateAppId: scope.checksAppId,
    rulesetId: scope.rulesetId,
  };
  const isCurrent = (pr: PullRequest) =>
    sameCandidate(pr, candidate, publisher.repositoryId) &&
    pr.state === "open" &&
    pr.merged === false &&
    pr.base.sha === candidate.baseSha &&
    workReference(pr.body) === candidate.workNumber;
  const checkIsHeld = async (pr: PullRequest) =>
    state.checkId !== undefined &&
    typeof (await verifyChecks(publisher, grant, repoPath, pr, "auto", false, {
      reservedCheck: {
        checkId: state.checkId,
        reservationId: scope.reservationId,
      },
    })) !== "string";
  const observeMerge = () => observeReservedWorkSquash(publisher, candidate);

  try {
    return await publisher.withinVerifiedBoundary(
      candidate,
      "auto",
      async () => {
        const current = await github<PullRequest>(publisher, prPath);
        if (!isCurrent(current)) {
          return observeMerge();
        }
        if (previousPhase === "reserved" || previousPhase === "queued") {
          return current.auto_merge === null &&
            (previousPhase === "reserved" || (await checkIsHeld(current)))
            ? ({ kind: "squash-cancelled" } as const)
            : null;
        }
        if (!isNativeSquashFrom(current, scope.controllerBotId)) {
          return observeMerge();
        }
        const held = previousPhase === "armed" && (await checkIsHeld(current));
        let response;
        try {
          response = await github<{
            readonly errors?: readonly unknown[];
            readonly data?: {
              readonly disablePullRequestAutoMerge?: {
                readonly clientMutationId?: string;
                readonly pullRequest?: {
                  readonly id?: string;
                  readonly autoMergeRequest?: object | null;
                };
              };
            };
          }>(
            publisher,
            "/graphql",
            "POST",
            {
              query: `mutation($input: DisablePullRequestAutoMergeInput!) {
            disablePullRequestAutoMerge(input: $input) {
              clientMutationId
              pullRequest { id autoMergeRequest { enabledAt } }
            }
          }`,
              variables: {
                input: {
                  pullRequestId: current.node_id,
                  clientMutationId: scope.reservationId,
                },
              },
            },
            publisher.mergeToken,
          );
        } catch {
          return observeMerge();
        }
        const disabled = response.data?.disablePullRequestAutoMerge;
        // A disable acknowledgement cannot exclude a squash already in flight
        // after gate release. Only an independently verified terminal outcome can.
        if (
          !held ||
          response.errors?.length ||
          disabled?.clientMutationId !== scope.reservationId ||
          disabled.pullRequest?.id !== current.node_id ||
          disabled.pullRequest.autoMergeRequest !== null
        ) {
          return observeMerge();
        }
        const after = await github<PullRequest>(publisher, prPath);
        return isCurrent(after) &&
          after.auto_merge === null &&
          (await checkIsHeld(after))
          ? ({ kind: "squash-cancelled" } as const)
          : observeMerge();
      },
    );
  } catch {
    return null;
  }
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
  const mandatory = ["code-review", "validation", "working-decisions"] as const;
  const supported = new Set([
    ...mandatory,
    "architecture-review",
    "functional-review",
    "specialist-review",
    "functional-approval",
    "governance-approval",
    "adr-approval",
  ]);
  const grantExpiresAt = Date.parse(grant?.expiresAt ?? "");
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
    Number.isNaN(grantExpiresAt) ||
    grantExpiresAt <= Date.now() ||
    grant.gateAppId !== 5625775 ||
    !Array.isArray(grant.requiredEvidence) ||
    !Array.isArray(grant.evidence) ||
    !Array.isArray(grant.requiredTasks) ||
    new Set(grant.requiredTasks).size !== grant.requiredTasks.length ||
    !grant.requiredTasks.every(positiveId) ||
    !mandatory.every((kind) => grant.requiredEvidence.includes(kind)) ||
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
  const checks = await verifyChecks(reader, grant, repo, pr, "direct", true, {
    evaluateGate: true,
  });
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
        reservedCheck ? { reservedCheck } : {},
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
      if (reservedCheck?.release) {
        const { checksToken, controllerBotId, admit } = reservedCheck.release;
        if (!isNativeSquashFrom(current, controllerBotId)) {
          return blocked("RESERVED_NATIVE_ARM_UNVERIFIED");
        }
        const completed = await completeReservedGateCheck({
          repository: publisher.repository,
          ...(publisher.fetchImpl ? { fetchImpl: publisher.fetchImpl } : {}),
          checksToken,
          name: gateName,
          headSha: candidate.headSha,
          reservationId: reservedCheck.reservationId,
          checkId: reservedCheck.checkId,
          expectedAppId: grant.gateAppId,
          beforePatch: async () => {
            const binding = createHash("sha256")
              .update(
                JSON.stringify([
                  candidate,
                  reservedCheck.reservationId,
                  reservedCheck.checkId,
                  grant,
                ]),
              )
              .digest("hex");
            return isDeepStrictEqual(await publisher.readGrant(), grant)
              ? admit(binding)
              : null;
          },
          title: "Work Merge Gate: PASS",
          summary: `Work #${candidate.workNumber} / PR #${candidate.pullNumber}\nHead: ${candidate.headSha}\nBase: ${candidate.baseSha}`,
        });
        if (completed) {
          return { status: "gate-released", checkId: completed.id };
        }
        const merged = await observeReservedWorkSquash(publisher, candidate);
        return merged
          ? { status: "merged", sha: merged.sha }
          : {
              status: "uncertain",
              reason: "RESERVED_GATE_RELEASE_NOT_CONFIRMED",
            };
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
          if (reservedCheck && !(await reservedCheck.authorizeArm?.())) {
            return blocked("STANDING_ARM_AUTHORITY_UNVERIFIED");
          }
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
            armedPr.autoMergeRequest &&
            (!reservedCheck ||
              (await observeReservedNativeArm(
                publisher,
                candidate,
                publisher.actorId,
              )))
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
