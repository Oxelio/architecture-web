import type { WorkState } from "../control/eligibility.js";
import type { FetchLike } from "./github-project-inventory.js";

const repositoryId = 1336937640;
const projectNumber = 3;
const workflowPath = ".github/workflows/delivery-project-status.yml";

type CoordinatedStatus = Exclude<WorkState, "Done">;
const coordinatedStatuses = [
  "Idea",
  "Exploring",
  "Designing",
  "Awaiting Approval",
  "Preparing",
  "Ready",
  "Implementing",
  "Reviewing",
  "Validating",
] as const satisfies readonly CoordinatedStatus[];

export interface ProjectStatusCommand {
  readonly kind: "record-work-status";
  readonly repositoryId: typeof repositoryId;
  readonly projectNumber: typeof projectNumber;
  readonly workNumber: number;
  readonly from: CoordinatedStatus;
  readonly to: CoordinatedStatus;
  readonly statusUpdatedAt: string;
  readonly evidenceCommentIds: readonly number[];
}

export interface ProjectStatusComment {
  readonly id: number;
  readonly issue_url: string;
  readonly body: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly user: { readonly id: number; readonly type: string };
  readonly performed_via_github_app?: { readonly id: number } | null;
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isCoordinatedStatus(value: unknown): value is CoordinatedStatus {
  return coordinatedStatuses.includes(value as CoordinatedStatus);
}

export async function authenticateProjectStatusCommand(input: {
  readonly workNumber: number;
  readonly commentId: number;
  readonly actorId: number;
  readonly now: () => number;
  readonly readComment: () => Promise<ProjectStatusComment | null>;
  // The caller must verify a current, unedited direct maintainer record.
  readonly readChannelPolicy: () => Promise<unknown>;
}): Promise<ProjectStatusCommand | null> {
  if (![input.workNumber, input.commentId, input.actorId].every(positiveId)) {
    return null;
  }

  try {
    const [comment, policy] = await Promise.all([
      input.readComment(),
      input.readChannelPolicy(),
    ]);
    if (
      comment?.id !== input.commentId ||
      comment.issue_url !==
        `https://api.github.com/repos/Oxelio/architecture-web/issues/${input.workNumber}` ||
      comment.user.type !== "User" ||
      comment.user.id !== input.actorId ||
      !comment.created_at ||
      comment.created_at !== comment.updated_at ||
      comment.body.length > 4096 ||
      !policy ||
      typeof policy !== "object" ||
      Array.isArray(policy)
    ) {
      return null;
    }

    const channel = policy as Record<string, unknown>;
    const expiresAt = channel["expiresAt"];
    if (
      channel["kind"] !== "work-status-channel" ||
      channel["repositoryId"] !== repositoryId ||
      channel["projectNumber"] !== projectNumber ||
      channel["workflowPath"] !== workflowPath ||
      channel["actorId"] !== comment.user.id ||
      !positiveId(channel["appId"]) ||
      channel["appId"] !== comment.performed_via_github_app?.id ||
      typeof expiresAt !== "string" ||
      (Number.isNaN(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= input.now())
    ) {
      return null;
    }

    const command = JSON.parse(comment.body) as Record<string, unknown> | null;
    const evidence = command?.["evidenceCommentIds"];
    if (
      command?.["kind"] !== "record-work-status" ||
      Object.keys(command).length !== 8 ||
      command["repositoryId"] !== repositoryId ||
      command["projectNumber"] !== projectNumber ||
      command["workNumber"] !== input.workNumber ||
      !isCoordinatedStatus(command["from"]) ||
      !isCoordinatedStatus(command["to"]) ||
      command["from"] === command["to"] ||
      typeof command["statusUpdatedAt"] !== "string" ||
      (Number.isNaN(Date.parse(comment.created_at)) ||
        Number.isNaN(Date.parse(command["statusUpdatedAt"])) ||
        Date.parse(comment.created_at) <=
          Date.parse(command["statusUpdatedAt"])) ||
      !Array.isArray(evidence) ||
      evidence.length < 1 ||
      evidence.length > 20 ||
      !evidence.every(positiveId) ||
      evidence.includes(input.commentId) ||
      new Set(evidence).size !== evidence.length
    ) {
      return null;
    }

    return {
      kind: "record-work-status",
      repositoryId,
      projectNumber,
      workNumber: input.workNumber,
      from: command["from"],
      to: command["to"],
      statusUpdatedAt: command["statusUpdatedAt"],
      evidenceCommentIds: evidence,
    };
  } catch {
    return null;
  }
}

// Only a definitive creation grants permission to start a write. The caller
// verifies ref protections and the matching pending intent before admission.
export async function claimProjectStatusCommand(input: {
  readonly commentId: number;
  readonly workflowSha: string;
  readonly controllerToken: string;
  readonly fetchImpl?: FetchLike;
}): Promise<boolean> {
  if (
    !positiveId(input.commentId) ||
    !/^[0-9a-f]{40}$/u.test(input.workflowSha) ||
    !input.controllerToken.trim()
  ) {
    return false;
  }

  const ref = `refs/tags/delivery-control/status-${input.commentId}`;
  try {
    const response = await (input.fetchImpl ?? fetch)(
      "https://api.github.com/repos/Oxelio/architecture-web/git/refs",
      {
        method: "POST",
        redirect: "error",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${input.controllerToken}`,
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ ref, sha: input.workflowSha }),
      },
    );
    if (response.status !== 201) {
      return false;
    }
    const receipt = (await response.json()) as {
      readonly ref?: string;
      readonly object?: { readonly type?: string; readonly sha?: string };
    } | null;
    return (
      receipt?.ref === ref &&
      receipt.object?.type === "commit" &&
      receipt.object.sha === input.workflowSha
    );
  } catch {
    return false;
  }
}
