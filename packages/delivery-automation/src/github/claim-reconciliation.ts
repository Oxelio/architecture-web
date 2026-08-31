import { parseTaskClaim } from "../control/task-claim.js";
import type { ProjectWorkItemSnapshot } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";

export interface ReleasableAutomatedClaim {
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly generation: string;
  readonly runId: string;
}

export interface RetainedClaimObservation {
  readonly workNumber: number;
  readonly reason:
    "HUMAN_CLAIM" | "RUN_ACTIVE" | "RUN_UNAVAILABLE" | "CLAIM_INCONSISTENT";
}

export interface ClaimReconciliationPlan {
  readonly releasable: readonly ReleasableAutomatedClaim[];
  readonly retained: readonly RetainedClaimObservation[];
}

interface WorkflowRunResponse {
  readonly status?: string;
}

function headers(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2026-03-10",
  };
}

async function runStatus(input: {
  readonly repository: string;
  readonly runId: string;
  readonly repositoryToken: string;
  readonly fetchImpl: FetchLike;
}): Promise<"completed" | "active" | "unavailable"> {
  const response = await input.fetchImpl(
    `https://api.github.com/repos/${input.repository}/actions/runs/${input.runId}`,
    { headers: headers(input.repositoryToken) },
  );
  if (!response.ok) {
    return "unavailable";
  }
  const payload = (await response.json()) as WorkflowRunResponse;
  if (payload.status === "completed") {
    return "completed";
  }
  if (typeof payload.status === "string" && payload.status.length > 0) {
    return "active";
  }
  return "unavailable";
}

export async function planClaimReconciliation(input: {
  readonly repository: string;
  readonly repositoryToken: string;
  readonly items: readonly ProjectWorkItemSnapshot[];
  readonly fetchImpl?: FetchLike;
}): Promise<ClaimReconciliationPlan> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const releasable: ReleasableAutomatedClaim[] = [];
  const retained: RetainedClaimObservation[] = [];

  for (const item of input.items) {
    const claim = parseTaskClaim(item.fields);
    if (claim.state === "idle") {
      continue;
    }
    if (claim.state === "inconsistent") {
      retained.push({
        workNumber: item.issueNumber,
        reason: "CLAIM_INCONSISTENT",
      });
      continue;
    }
    if (!claim.record.claimant.startsWith("agent:") || !claim.record.runId) {
      retained.push({ workNumber: item.issueNumber, reason: "HUMAN_CLAIM" });
      continue;
    }

    const status = await runStatus({
      repository: input.repository,
      runId: claim.record.runId,
      repositoryToken: input.repositoryToken,
      fetchImpl,
    });
    if (status === "completed") {
      releasable.push({
        workNumber: item.issueNumber,
        taskNumber: claim.record.taskNumber,
        generation: claim.record.generation,
        runId: claim.record.runId,
      });
    } else {
      retained.push({
        workNumber: item.issueNumber,
        reason: status === "active" ? "RUN_ACTIVE" : "RUN_UNAVAILABLE",
      });
    }
  }

  return {
    releasable: releasable.toSorted(
      (left, right) => left.workNumber - right.workNumber,
    ),
    retained: retained.toSorted(
      (left, right) => left.workNumber - right.workNumber,
    ),
  };
}
