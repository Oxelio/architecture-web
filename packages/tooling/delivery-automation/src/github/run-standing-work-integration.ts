import {
  isWorkIntegrationCandidate,
  sameWorkIntegrationCandidate,
  type WorkIntegrationContext,
} from "../control/work-integration-request.js";
import { executeEligibleStandingWorkIntegration } from "./eligible-standing-work-integration.js";
import {
  readReservedGitHubWorkIntegration,
  reconcileReservedGitHubWorkIntegration,
  recordReleasedNativeSquash,
} from "./reserved-work-integration.js";
import {
  discoverStandingWorkMergeGrant,
  type StandingEvidenceAuthority,
  verifyStandingJournalRules,
} from "./work-merge-publisher.js";

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
  readonly expiresAt: string;
}

export async function runStandingWorkIntegration(
  input: Omit<StandingInput, "authorize" | "operation" | "scope"> & {
    readonly scope: Omit<StandingInput["scope"], "publisher"> & {
      readonly publisher: Omit<
        StandingInput["scope"]["publisher"],
        "readGrant"
      >;
    };
    readonly readEvidenceAuthority: () => Promise<StandingEvidenceAuthority | null>;
    readonly context: Omit<WorkIntegrationContext, "actorId">;
    readonly journalRules: Parameters<typeof verifyStandingJournalRules>[1];
    readonly readDelegation: () => Promise<StandingDelegation | null>;
    readonly authorizeRecovery: (
      candidate: StandingInput["candidate"],
    ) => Promise<boolean>;
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

  const { context, candidate } = input;
  const { scope: bindings } = input;
  const verifyJournal = () =>
    verifyStandingJournalRules(bindings.publisher, input.journalRules);
  const scope: StandingInput["scope"] = {
    ...bindings,
    publisher: {
      ...bindings.publisher,
      withinVerifiedBoundary: (target, mode, action) =>
        bindings.publisher.withinVerifiedBoundary(target, mode, async () =>
          (await verifyJournal()) ? action() : null,
        ),
      readGrant: async () => {
        const authority = await input.readEvidenceAuthority();
        const rulesetId = bindings.cancellationRulesetId;
        return authority && rulesetId
          ? discoverStandingWorkMergeGrant(bindings.publisher, candidate, {
              gateAppId: bindings.checksAppId,
              rulesetId,
              authority,
            })
          : null;
      },
    },
  };
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

  if (!(await verifyJournal())) {
    return { status: "denied" };
  }

  const readLiveDelegation = async (): Promise<StandingDelegation | null> => {
    try {
      const delegation = await input.readDelegation();
      return delegation?.repositoryId === context.repositoryId &&
        delegation.controllerBotId === scope.controllerBotId &&
        delegation.workflowSha === context.workflowSha &&
        delegation.gatePublication === true &&
        delegation.nativeSquash === true &&
        Date.parse(delegation.expiresAt) > Date.now()
        ? delegation
        : null;
    } catch {
      return null;
    }
  };

  const authorize: StandingInput["authorize"] = async (request) =>
    sameWorkIntegrationCandidate(candidate, request.candidate) &&
    (request.operation === "queue-check" ||
      request.operation === "arm-squash" ||
      request.operation === "release-check") &&
    (await readLiveDelegation()) !== null;

  // Recovery can only persist a positive observation of an existing intent.
  // It must remain independently authorized after standing delegation ends.
  const authorizeObservation =
    (previous: typeof candidate): StandingInput["authorize"] =>
    async (request) =>
      request.operation === "resolve" &&
      sameWorkIntegrationCandidate(previous, request.candidate) &&
      (await input.authorizeRecovery(previous)) &&
      (await verifyJournal());

  const recordReleased = (released: typeof candidate) =>
    recordReleasedNativeSquash({
      candidate: released,
      scope,
      authorize: authorizeObservation(released),
    });

  const operations = ["queue-check", "arm-squash", "release-check"] as const;
  let start = 0;
  try {
    let reservation = (await readReservedGitHubWorkIntegration(scope))
      ?.reservation;
    if (reservation?.state.phase === "pending") {
      const { candidate: previous, state } = reservation;
      const resolution = await reconcileReservedGitHubWorkIntegration({
        candidate: previous,
        scope,
        authorize: authorizeObservation(previous),
      });
      if (resolution.status !== "confirmed") {
        return resolution.status === "denied"
          ? { status: "denied" }
          : {
              status: "deferred",
              operation:
                state.operation === "resolve" ? "queue-check" : state.operation,
            };
      }
      reservation = resolution.receipt.reservation;
    }
    if (reservation?.state.phase === "released") {
      const previous = reservation.candidate;
      const merged = await recordReleased(previous);
      if (sameWorkIntegrationCandidate(candidate, previous)) {
        return merged
          ? { status: "merged", sha: merged }
          : { status: "released", checkId: reservation.state.checkId };
      }
      if (!merged) {
        return { status: "deferred", operation: "queue-check" };
      }
    } else if (
      reservation &&
      sameWorkIntegrationCandidate(candidate, reservation.candidate)
    ) {
      const { state } = reservation;
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
        default:
          return { status: "denied" };
      }
    }
  } catch {
    return { status: "deferred", operation: "queue-check" };
  }

  if (!(await authorize({ candidate, operation: "queue-check" }))) {
    return { status: "denied" };
  }

  for (const operation of operations.slice(start)) {
    const result = await executeEligibleStandingWorkIntegration({
      ...input,
      scope: {
        ...scope,
        readReleaseAuthority: async () => {
          const delegation = await readLiveDelegation();
          if (!delegation) {
            return null;
          }
          return {
            identity: JSON.stringify(delegation),
            expiresAt: Date.parse(delegation.expiresAt),
          };
        },
      },
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
      const merged = await recordReleased(candidate);
      return merged
        ? { status: "merged", sha: merged }
        : { status: "released", checkId: state.checkId };
    }
  }

  return { status: "deferred", operation: "release-check" };
}
