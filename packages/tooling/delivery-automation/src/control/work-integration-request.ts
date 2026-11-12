import type {
  MergeCandidate,
  WorkGateEvaluationGrant,
} from "../github/work-merge-publisher.js";

const repositoryId = 1336937640;
const maintainerId = 83680141;
const shaPattern = /^[0-9a-f]{40}$/u;

export interface WorkIntegrationContext {
  readonly repository: string;
  readonly repositoryId: number;
  readonly actorId: number;
  readonly ref: string;
  readonly workflowSha: string;
  readonly runAttempt: string;
}

export type WorkIntegrationRequest =
  | {
      readonly kind: "maintainer-dispatch";
      readonly candidate: MergeCandidate;
      readonly grant: WorkGateEvaluationGrant | null;
    }
  | {
      readonly kind: "standing";
      readonly candidate: MergeCandidate;
    };

export function isWorkIntegrationCandidate(
  value: unknown,
): value is MergeCandidate {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<MergeCandidate>;
  return (
    typeof candidate.workNumber === "number" &&
    Number.isSafeInteger(candidate.workNumber) &&
    candidate.workNumber > 0 &&
    typeof candidate.pullNumber === "number" &&
    Number.isSafeInteger(candidate.pullNumber) &&
    candidate.pullNumber > 0 &&
    typeof candidate.headSha === "string" &&
    shaPattern.test(candidate.headSha) &&
    typeof candidate.baseSha === "string" &&
    shaPattern.test(candidate.baseSha)
  );
}

export function sameWorkIntegrationCandidate(
  candidate: MergeCandidate,
  other: unknown,
): boolean {
  return (
    isWorkIntegrationCandidate(candidate) &&
    isWorkIntegrationCandidate(other) &&
    candidate.workNumber === other.workNumber &&
    candidate.pullNumber === other.pullNumber &&
    candidate.headSha === other.headSha &&
    candidate.baseSha === other.baseSha
  );
}

export function authorizeWorkIntegrationEvaluation(
  context: WorkIntegrationContext,
  request: WorkIntegrationRequest,
  now: number,
): WorkGateEvaluationGrant | null {
  if (
    context.repository.toLowerCase() !== "oxelio/architecture-web" ||
    context.repositoryId !== repositoryId ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    !isWorkIntegrationCandidate(request.candidate) ||
    request.candidate.baseSha !== context.workflowSha
  ) {
    return null;
  }

  // The standing authority is added only with its independently verified
  // provider and activation boundary. An ordinary request grants no authority.
  if (request.kind !== "maintainer-dispatch") {
    return null;
  }

  const { grant } = request;
  if (
    context.actorId !== maintainerId ||
    grant?.purpose !== "evaluate-work-merge-gate" ||
    grant.actorId !== context.actorId ||
    grant.repositoryId !== context.repositoryId ||
    !sameWorkIntegrationCandidate(request.candidate, grant) ||
    !(Date.parse(grant.expiresAt) > now) ||
    "direct" in grant ||
    "auto" in grant
  ) {
    return null;
  }

  return grant;
}
