import type { MergeCandidate } from "../github/work-merge-publisher.js";
import { workReference } from "../github/work-reference.js";
import { isWorkIntegrationCandidate } from "./work-integration-request.js";

interface CandidatePull {
  readonly number: number;
  readonly body: string | null;
  readonly state: string;
  readonly draft: boolean;
  readonly merged: boolean;
  readonly head: {
    readonly sha: string;
    readonly repo?: { readonly id: number } | null;
  };
  readonly base: {
    readonly sha: string;
    readonly ref: string;
    readonly repo?: { readonly id: number } | null;
  };
}

interface ValidationWakeup {
  readonly action?: string;
  readonly repository?: { readonly id?: number };
  readonly workflow_run?: {
    readonly id?: number;
    readonly path?: string;
    readonly event?: string;
    readonly status?: string;
    readonly conclusion?: string;
    readonly head_sha?: string;
    readonly repository?: { readonly id?: number };
    readonly head_repository?: { readonly id?: number };
    readonly pull_requests?: readonly { readonly number?: number }[];
  };
}

const repositoryId = 1336937640;

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function readStandingIntegrationWakeup(input: {
  readonly event: ValidationWakeup | null;
  readonly trustedMainSha: string;
  readonly readPull: (number: number) => Promise<CandidatePull>;
  readonly ownsCandidate: (candidate: MergeCandidate) => Promise<boolean>;
}): Promise<
  | {
      readonly status: "selected";
      readonly candidate: MergeCandidate;
      readonly validationRunId: number;
    }
  | { readonly status: "ignored" }
> {
  const { event } = input;
  const run = event?.workflow_run;
  if (
    event?.action !== "completed" ||
    event.repository?.id !== repositoryId ||
    run?.repository?.id !== repositoryId ||
    run.head_repository?.id !== repositoryId ||
    run.path !== ".github/workflows/delivery-automation-validation.yml" ||
    run.event !== "pull_request" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    !positiveInteger(run.id) ||
    !Array.isArray(run.pull_requests) ||
    run.pull_requests.length !== 1 ||
    !positiveInteger(run.pull_requests[0]?.number)
  ) {
    return { status: "ignored" };
  }

  try {
    const pullNumber = run.pull_requests[0].number;
    const pr = await input.readPull(pullNumber);
    const candidate = {
      workNumber: workReference(pr.body),
      pullNumber,
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
    };
    if (
      !isWorkIntegrationCandidate(candidate) ||
      !matchesCurrentPull(pr, candidate, input.trustedMainSha) ||
      pr.head.sha !== run.head_sha ||
      !(await input.ownsCandidate(candidate))
    ) {
      return { status: "ignored" };
    }
    return { status: "selected", candidate, validationRunId: run.id };
  } catch {
    return { status: "ignored" };
  }
}

interface EvidenceWakeup {
  readonly action?: string;
  readonly repository?: { readonly id?: number };
  readonly issue?: { readonly number?: number; readonly pull_request?: object };
  readonly comment?: { readonly id?: number; readonly body?: string };
}

const wakeupEvidence = new Set([
  "code-review",
  "architecture-review",
  "functional-review",
  "specialist-review",
  "validation",
  "working-decisions",
  "functional-approval",
  "governance-approval",
  "adr-approval",
]);

export async function readStandingEvidenceWakeup(input: {
  readonly event: EvidenceWakeup | null;
  readonly authorizeSignal: (
    commentId: number,
    kind: string,
    body: string,
  ) => Promise<boolean>;
  readonly trustedMainSha: string;
  readonly readPull: (number: number) => Promise<CandidatePull>;
  readonly ownsCandidate: (candidate: MergeCandidate) => Promise<boolean>;
}): Promise<
  | { readonly status: "selected"; readonly candidate: MergeCandidate }
  | { readonly status: "ignored" }
> {
  const { event } = input;
  const body = event?.comment?.body;
  const issue = event?.issue;
  if (
    event?.action !== "created" ||
    event.repository?.id !== repositoryId ||
    !positiveInteger(issue?.number) ||
    !positiveInteger(event.comment?.id) ||
    typeof body !== "string" ||
    body.length > 8192
  ) {
    return { status: "ignored" };
  }

  try {
    const value: unknown = JSON.parse(body);
    if (!isWorkIntegrationCandidate(value)) {
      return { status: "ignored" };
    }
    const record = value as MergeCandidate & {
      readonly kind?: string;
      readonly decision?: string;
    };
    if (
      !record.kind ||
      !wakeupEvidence.has(record.kind) ||
      record.decision !== "accepted" ||
      issue.number !==
        (issue.pull_request ? record.pullNumber : record.workNumber)
    ) {
      return { status: "ignored" };
    }

    if (!(await input.authorizeSignal(event.comment.id, record.kind, body))) {
      return { status: "ignored" };
    }
    const pr = await input.readPull(record.pullNumber);
    if (
      !matchesCurrentPull(pr, record, input.trustedMainSha) ||
      !(await input.ownsCandidate(record))
    ) {
      return { status: "ignored" };
    }
    // Event data locates the candidate. The controller independently reads and
    // authorizes its live evidence before any durable operation.
    const { workNumber, pullNumber, headSha, baseSha } = record;
    return {
      status: "selected",
      candidate: { workNumber, pullNumber, headSha, baseSha },
    };
  } catch {
    return { status: "ignored" };
  }
}

function matchesCurrentPull(
  pr: CandidatePull,
  candidate: MergeCandidate,
  trustedMainSha: string,
): boolean {
  return (
    pr.number === candidate.pullNumber &&
    pr.state === "open" &&
    pr.draft === false &&
    pr.merged === false &&
    pr.base.ref === "main" &&
    pr.base.repo?.id === repositoryId &&
    pr.head.repo?.id === repositoryId &&
    workReference(pr.body) === candidate.workNumber &&
    pr.head.sha === candidate.headSha &&
    pr.base.sha === candidate.baseSha &&
    pr.base.sha === trustedMainSha
  );
}
