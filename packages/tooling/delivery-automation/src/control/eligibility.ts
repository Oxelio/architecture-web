export type WorkState =
  | "Idea"
  | "Exploring"
  | "Designing"
  | "Awaiting Approval"
  | "Preparing"
  | "Ready"
  | "Implementing"
  | "Reviewing"
  | "Validating"
  | "Done";

export type Priority =
  "P0 — Critical" | "P1 — High" | "P2 — Normal" | "P3 — Low";

export type DependencyState = "resolved" | "blocked" | "unavailable";
export type WipState = "available" | "blocked" | "unavailable";
export type ClaimState = "idle" | "active" | "inconsistent" | "unavailable";
export type TaskParentState = "verified" | "mismatch" | "unavailable";

export type TargetRefSource = "authorized-work-context" | "agent-output";

export type TaskClaimExecution =
  | { readonly kind: "human" }
  | { readonly kind: "automated"; readonly executorRoute: string };

export type EligibilityBlocker =
  | "WORK_CLOSED"
  | "TASK_CLOSED"
  | "TASK_PARENT_OWNER_UNAVAILABLE"
  | "TASK_PARENT_MISMATCH"
  | "WORK_STATE_OWNER_UNAVAILABLE"
  | "WORK_NOT_READY"
  | "WORK_NOT_IMPLEMENTING"
  | "DEPENDENCY_OWNER_UNAVAILABLE"
  | "DEPENDENCY_BLOCKED"
  | "WIP_STATE_UNAVAILABLE"
  | "WIP_LIMIT_REACHED"
  | "ROUTE_OWNER_UNAVAILABLE"
  | "ROUTE_UNASSIGNED"
  | "ROUTE_CONFLICT"
  | "ROUTE_HUMAN_ONLY"
  | "ROUTE_MISMATCH"
  | "CLAIM_OWNER_UNAVAILABLE"
  | "CLAIM_INCONSISTENT"
  | "CLAIM_ACTIVE"
  | "TARGET_REF_UNAVAILABLE"
  | "TARGET_REF_FROM_AGENT_OUTPUT"
  | "TARGET_REF_NOT_AUTHORIZED"
  | "PRIORITY_OWNER_UNAVAILABLE";

export interface TargetRefState {
  readonly ref: string | null;
  readonly source: TargetRefSource | null;
  readonly authorizedRefs: readonly string[];
}

export interface RouteState {
  readonly mappingActive: boolean;
  readonly labels: readonly string[];
}

export interface WorkPullCandidate {
  readonly workNumber: number;
  readonly workOpen: boolean;
  readonly workStateAvailable: boolean;
  readonly workState: WorkState | null;
  readonly dependencyState: DependencyState;
  readonly wipState: WipState;
  readonly route: RouteState;
  readonly priorityAvailable: boolean;
  readonly priority: Priority | null;
}

export interface TaskDispatchCandidate {
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly workOpen: boolean;
  readonly taskOpen: boolean;
  readonly taskParentState: TaskParentState;
  readonly workStateAvailable: boolean;
  readonly workState: WorkState | null;
  readonly dependencyState: DependencyState;
  readonly route: RouteState;
  readonly claimState: ClaimState;
  readonly targetRef: TargetRefState;
}

export interface EligibilityDecision {
  readonly eligible: boolean;
  readonly blockers: readonly EligibilityBlocker[];
  readonly route: string | null;
  readonly targetRef: string | null;
}

export interface WorkSelectionDecision {
  readonly selectedWorkNumber: number | null;
  readonly candidates: readonly {
    readonly workNumber: number;
    readonly decision: EligibilityDecision;
  }[];
}

const priorityOrder: Record<Priority, number> = {
  "P0 — Critical": 0,
  "P1 — High": 1,
  "P2 — Normal": 2,
  "P3 — Low": 3,
};

function activeAgentRoutes(route: RouteState): readonly string[] {
  return route.labels.filter((label) => label.startsWith("agent:"));
}

function evaluateRoute(
  route: RouteState,
  executorRoute: string,
  blockers: EligibilityBlocker[],
): string | null {
  if (!route.mappingActive) {
    blockers.push("ROUTE_OWNER_UNAVAILABLE");
    return null;
  }

  const routes = activeAgentRoutes(route);
  if (routes.length === 0) {
    blockers.push("ROUTE_UNASSIGNED");
    return null;
  }
  if (routes.length > 1) {
    blockers.push("ROUTE_CONFLICT");
    return null;
  }

  const selectedRoute = routes[0];
  if (!selectedRoute) {
    throw new Error("Route cardinality invariant violated");
  }
  if (selectedRoute === "agent:human") {
    blockers.push("ROUTE_HUMAN_ONLY");
    return selectedRoute;
  }
  if (selectedRoute !== executorRoute) {
    blockers.push("ROUTE_MISMATCH");
  }

  return selectedRoute;
}

function evaluateTargetRef(
  target: TargetRefState,
  blockers: EligibilityBlocker[],
): string | null {
  if (!target.ref || !target.source) {
    blockers.push("TARGET_REF_UNAVAILABLE");
    return null;
  }
  if (target.source === "agent-output") {
    blockers.push("TARGET_REF_FROM_AGENT_OUTPUT");
    return target.ref;
  }
  if (!target.authorizedRefs.includes(target.ref)) {
    blockers.push("TARGET_REF_NOT_AUTHORIZED");
  }

  return target.ref;
}

function evaluateDependencies(
  dependencyState: DependencyState,
  blockers: EligibilityBlocker[],
): void {
  if (dependencyState === "unavailable") {
    blockers.push("DEPENDENCY_OWNER_UNAVAILABLE");
  } else if (dependencyState === "blocked") {
    blockers.push("DEPENDENCY_BLOCKED");
  }
}

function evaluateTaskExecutionPrerequisites(
  candidate: TaskDispatchCandidate,
  blockers: EligibilityBlocker[],
): void {
  if (!candidate.workOpen) {
    blockers.push("WORK_CLOSED");
  }
  if (!candidate.taskOpen) {
    blockers.push("TASK_CLOSED");
  }
  if (candidate.taskParentState === "unavailable") {
    blockers.push("TASK_PARENT_OWNER_UNAVAILABLE");
  } else if (candidate.taskParentState === "mismatch") {
    blockers.push("TASK_PARENT_MISMATCH");
  }

  if (!candidate.workStateAvailable || candidate.workState === null) {
    blockers.push("WORK_STATE_OWNER_UNAVAILABLE");
  } else if (candidate.workState !== "Implementing") {
    blockers.push("WORK_NOT_IMPLEMENTING");
  }

  evaluateDependencies(candidate.dependencyState, blockers);

  if (candidate.claimState === "unavailable") {
    blockers.push("CLAIM_OWNER_UNAVAILABLE");
  } else if (candidate.claimState === "inconsistent") {
    blockers.push("CLAIM_INCONSISTENT");
  } else if (candidate.claimState === "active") {
    blockers.push("CLAIM_ACTIVE");
  }
}

export function evaluateWorkPull(
  candidate: WorkPullCandidate,
  executorRoute: string,
): EligibilityDecision {
  const blockers: EligibilityBlocker[] = [];

  if (!candidate.workOpen) {
    blockers.push("WORK_CLOSED");
  }

  if (!candidate.workStateAvailable || candidate.workState === null) {
    blockers.push("WORK_STATE_OWNER_UNAVAILABLE");
  } else if (candidate.workState !== "Ready") {
    blockers.push("WORK_NOT_READY");
  }

  evaluateDependencies(candidate.dependencyState, blockers);

  if (candidate.wipState === "unavailable") {
    blockers.push("WIP_STATE_UNAVAILABLE");
  } else if (candidate.wipState === "blocked") {
    blockers.push("WIP_LIMIT_REACHED");
  }

  const route = evaluateRoute(candidate.route, executorRoute, blockers);

  if (!candidate.priorityAvailable || candidate.priority === null) {
    blockers.push("PRIORITY_OWNER_UNAVAILABLE");
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    route,
    targetRef: null,
  };
}

export function evaluateTaskClaimAcquisition(
  candidate: TaskDispatchCandidate,
  execution: TaskClaimExecution,
): EligibilityDecision {
  const blockers: EligibilityBlocker[] = [];
  evaluateTaskExecutionPrerequisites(candidate, blockers);
  const route =
    execution.kind === "automated"
      ? evaluateRoute(candidate.route, execution.executorRoute, blockers)
      : null;
  const targetRef = evaluateTargetRef(candidate.targetRef, blockers);

  return {
    eligible: blockers.length === 0,
    blockers,
    route,
    targetRef,
  };
}

export function evaluateTaskDispatch(
  candidate: TaskDispatchCandidate,
  executorRoute: string,
): EligibilityDecision {
  const blockers: EligibilityBlocker[] = [];
  evaluateTaskExecutionPrerequisites(candidate, blockers);
  const route = evaluateRoute(candidate.route, executorRoute, blockers);
  const targetRef = evaluateTargetRef(candidate.targetRef, blockers);

  return {
    eligible: blockers.length === 0,
    blockers,
    route,
    targetRef,
  };
}

export function selectNextWork(
  candidates: readonly WorkPullCandidate[],
  executorRoute: string,
): WorkSelectionDecision {
  const evaluated = candidates.map((candidate) => ({
    candidate,
    decision: evaluateWorkPull(candidate, executorRoute),
  }));

  const eligible = evaluated
    .filter((entry) => entry.decision.eligible)
    .toSorted((left, right) => {
      const leftPriority = left.candidate.priority;
      const rightPriority = right.candidate.priority;
      if (!leftPriority || !rightPriority) {
        throw new Error("Eligible Work must have an available Priority");
      }

      const priorityDifference =
        priorityOrder[leftPriority] - priorityOrder[rightPriority];
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return left.candidate.workNumber - right.candidate.workNumber;
    });

  return {
    selectedWorkNumber: eligible[0]?.candidate.workNumber ?? null,
    candidates: evaluated.map(({ candidate, decision }) => ({
      workNumber: candidate.workNumber,
      decision,
    })),
  };
}
