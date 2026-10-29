export const taskClaimFieldNames = {
  activeTask: "Active Task",
  claimant: "Execution Claimant",
  generation: "Execution Claim Generation",
  run: "Execution Claim Run",
  acquiredAt: "Execution Claim Acquired At",
} as const;

export interface TaskClaimRecord {
  readonly taskNumber: number;
  readonly claimant: string;
  readonly generation: string;
  readonly runId: string | null;
  readonly acquiredAt: string;
}

export type ParsedTaskClaim =
  | { readonly state: "idle" }
  | { readonly state: "active"; readonly record: TaskClaimRecord }
  | {
      readonly state: "inconsistent";
      readonly presentFields: readonly string[];
    };

function trimmed(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function parseTaskNumber(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }
  const result = Number(value);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function presentFieldNames(
  fields: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.values(taskClaimFieldNames)
    .filter((name) => trimmed(fields[name]) !== null)
    .toSorted();
}

export function parseTaskClaim(
  fields: Readonly<Record<string, string>>,
): ParsedTaskClaim {
  const presentFields = presentFieldNames(fields);
  if (presentFields.length === 0) {
    return { state: "idle" };
  }

  const activeTask = trimmed(fields[taskClaimFieldNames.activeTask]);
  const claimant = trimmed(fields[taskClaimFieldNames.claimant]);
  const generation = trimmed(fields[taskClaimFieldNames.generation]);
  const runId = trimmed(fields[taskClaimFieldNames.run]);
  const acquiredAt = trimmed(fields[taskClaimFieldNames.acquiredAt]);
  const taskNumber = parseTaskNumber(activeTask);

  if (!taskNumber || !claimant || !generation || !acquiredAt) {
    return { state: "inconsistent", presentFields };
  }

  if (claimant.startsWith("agent:") && !runId) {
    return { state: "inconsistent", presentFields };
  }

  if (!claimant.startsWith("agent:") && runId) {
    return { state: "inconsistent", presentFields };
  }

  return {
    state: "active",
    record: {
      taskNumber,
      claimant,
      generation,
      runId,
      acquiredAt,
    },
  };
}

export function taskClaimFields(
  record: TaskClaimRecord,
): Readonly<Record<string, string>> {
  return {
    [taskClaimFieldNames.activeTask]: String(record.taskNumber),
    [taskClaimFieldNames.claimant]: record.claimant,
    [taskClaimFieldNames.generation]: record.generation,
    ...(record.runId ? { [taskClaimFieldNames.run]: record.runId } : {}),
    [taskClaimFieldNames.acquiredAt]: record.acquiredAt,
  };
}

export function sameTaskClaim(
  left: TaskClaimRecord,
  right: TaskClaimRecord,
): boolean {
  return (
    left.taskNumber === right.taskNumber &&
    left.claimant === right.claimant &&
    left.generation === right.generation &&
    left.runId === right.runId &&
    left.acquiredAt === right.acquiredAt
  );
}

export type WorkflowRunObservation =
  | { readonly status: "completed" }
  | { readonly status: "active" }
  | { readonly status: "unavailable" };

export function mayReconcileAutomatedClaim(
  claim: ParsedTaskClaim,
  run: WorkflowRunObservation,
): boolean {
  return (
    claim.state === "active" &&
    claim.record.claimant.startsWith("agent:") &&
    claim.record.runId !== null &&
    run.status === "completed"
  );
}
