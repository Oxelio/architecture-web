import {
  isWorkIntegrationCandidate,
  sameWorkIntegrationCandidate,
  type WorkIntegrationContext,
} from "../control/work-integration-request.js";
import { executeEligibleStandingWorkIntegration } from "./eligible-standing-work-integration.js";
import { readReservedGitHubWorkIntegration } from "./reserved-work-integration.js";

type StandingInput = Parameters<
  typeof executeEligibleStandingWorkIntegration
>[0];
type StandingOperation = Exclude<StandingInput["operation"], "resolve">;

export interface StandingDelegation {
  readonly repositoryId: number;
  readonly controllerBotId: number;
  readonly workflowSha: string;
  readonly gatePublication: boolean;
  readonly nativeSquash: boolean;
}

export async function runStandingWorkIntegration(
  input: Omit<StandingInput, "authorize" | "operation"> & {
    readonly context: Omit<WorkIntegrationContext, "actorId">;
    readonly readDelegation: () => Promise<StandingDelegation | null>;
  },
): Promise<
  | { readonly status: "inactive" | "denied" }
  | { readonly status: "deferred"; readonly operation: StandingOperation }
  | { readonly status: "released"; readonly checkId: number }
  | { readonly status: "merged"; readonly sha: string }
> {
  if (input.standingEnabled !== true) {
    return { status: "inactive" };
  }

  const { context, candidate, scope } = input;
  if (
    context.repository.toLowerCase() !== "oxelio/architecture-web" ||
    context.repositoryId !== 1336937640 ||
    context.ref !== "refs/heads/main" ||
    context.runAttempt !== "1" ||
    context.workflowSha !== candidate.baseSha ||
    scope.publisher.repository.toLowerCase() !==
      context.repository.toLowerCase() ||
    scope.publisher.repositoryId !== context.repositoryId ||
    scope.publisher.actorId !== scope.controllerBotId ||
    !isWorkIntegrationCandidate(candidate)
  ) {
    return { status: "denied" };
  }

  const authorize: StandingInput["authorize"] = async (request) => {
    if (
      !sameWorkIntegrationCandidate(candidate, request.candidate) ||
      (request.operation !== "queue-check" &&
        request.operation !== "arm-squash" &&
        request.operation !== "release-check")
    ) {
      return false;
    }
    try {
      const delegation = await input.readDelegation();
      return (
        delegation?.repositoryId === context.repositoryId &&
        delegation.controllerBotId === scope.controllerBotId &&
        delegation.workflowSha === context.workflowSha &&
        delegation.gatePublication === true &&
        delegation.nativeSquash === true
      );
    } catch {
      return false;
    }
  };

  const operations = ["queue-check", "arm-squash", "release-check"] as const;
  if (!(await authorize({ candidate, operation: "queue-check" }))) {
    return { status: "denied" };
  }
  let start = 0;
  try {
    const existing = await readReservedGitHubWorkIntegration(scope);
    if (
      existing &&
      sameWorkIntegrationCandidate(candidate, existing.reservation.candidate)
    ) {
      const { state } = existing.reservation;
      switch (state.phase) {
        case "reserved":
          break;
        case "queued":
          start = 1;
          break;
        case "armed":
          start = 2;
          break;
        case "merged":
          return { status: "merged", sha: state.sha };
        case "released":
          return { status: "released", checkId: state.checkId };
        case "pending":
          return {
            status: "deferred",
            operation:
              state.operation === "resolve" ? "queue-check" : state.operation,
          };
        default:
          return { status: "denied" };
      }
    }
  } catch {
    return { status: "deferred", operation: "queue-check" };
  }

  for (const operation of operations.slice(start)) {
    const result = await executeEligibleStandingWorkIntegration({
      ...input,
      authorize,
      operation,
    });
    if (result.status !== "confirmed") {
      return result.status === "denied"
        ? { status: "denied" }
        : { status: "deferred", operation };
    }
    const { state } = result.receipt.reservation;
    if (state.phase === "merged") {
      return { status: "merged", sha: state.sha };
    }
    if (state.phase === "released") {
      return { status: "released", checkId: state.checkId };
    }
  }

  return { status: "deferred", operation: "release-check" };
}
