import {
  type EligibilityDecision,
  evaluateTaskDispatch,
  selectNextWork,
  type TaskDispatchCandidate,
  type WorkPullCandidate,
  type WorkSelectionDecision,
} from "./eligibility.js";

export interface ReadyQueuePlan {
  readonly mode: "ready-queue";
  readonly executorRoute: string;
  readonly selectedWorkNumber: number | null;
  readonly decision: WorkSelectionDecision;
  readonly dispatchRequested: false;
}

export interface TaskDispatchPlan {
  readonly mode: "task-dispatch";
  readonly executorRoute: string;
  readonly workNumber: number;
  readonly taskNumber: number;
  readonly decision: EligibilityDecision;
  readonly dispatchRequested: boolean;
  readonly claimRequired: boolean;
  readonly targetRef: string | null;
}

function assertExecutorRoute(route: string): void {
  if (!/^agent:[a-z0-9][a-z0-9-]*$/.test(route)) {
    throw new Error(`Invalid executor route '${route}'`);
  }
}

export function planReadyQueue(input: {
  readonly candidates: readonly WorkPullCandidate[];
  readonly executorRoute: string;
}): ReadyQueuePlan {
  assertExecutorRoute(input.executorRoute);
  const decision = selectNextWork(input.candidates, input.executorRoute);

  return {
    mode: "ready-queue",
    executorRoute: input.executorRoute,
    selectedWorkNumber: decision.selectedWorkNumber,
    decision,
    dispatchRequested: false,
  };
}

export function planTaskDispatch(input: {
  readonly candidate: TaskDispatchCandidate;
  readonly executorRoute: string;
}): TaskDispatchPlan {
  assertExecutorRoute(input.executorRoute);
  const decision = evaluateTaskDispatch(input.candidate, input.executorRoute);

  return {
    mode: "task-dispatch",
    executorRoute: input.executorRoute,
    workNumber: input.candidate.workNumber,
    taskNumber: input.candidate.taskNumber,
    decision,
    dispatchRequested: decision.eligible,
    claimRequired: decision.eligible,
    targetRef: decision.targetRef,
  };
}
