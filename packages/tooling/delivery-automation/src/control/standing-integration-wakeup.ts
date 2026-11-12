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
      pr.number !== pullNumber ||
      pr.state !== "open" ||
      pr.draft !== false ||
      pr.merged !== false ||
      pr.base.ref !== "main" ||
      pr.base.repo?.id !== repositoryId ||
      pr.head.repo?.id !== repositoryId ||
      pr.head.sha !== run.head_sha ||
      pr.base.sha !== input.trustedMainSha ||
      !isWorkIntegrationCandidate(candidate) ||
      !(await input.ownsCandidate(candidate))
    ) {
      return { status: "ignored" };
    }
    return { status: "selected", candidate, validationRunId: run.id };
  } catch {
    return { status: "ignored" };
  }
}
