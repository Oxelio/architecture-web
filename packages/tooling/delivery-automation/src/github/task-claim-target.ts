import { taskClaimFieldNames } from "../control/task-claim.js";
import type { ProjectSnapshot } from "../inventory/project-inventory.js";
import type { ProjectWorkItemSnapshot } from "./github-operational-state.js";
import type {
  TaskClaimFieldIds,
  TaskClaimTarget,
} from "./task-claim-publisher.js";

function resolveTextFieldId(project: ProjectSnapshot, name: string): string {
  const matches = project.fields.filter((field) => field.name === name);
  if (matches.length !== 1) {
    throw new Error(
      `Task claim field '${name}' must resolve exactly once; found ${matches.length}`,
    );
  }

  const field = matches[0];
  if (!field) {
    throw new Error(`Task claim field '${name}' resolution invariant violated`);
  }
  if (field.dataType !== "TEXT") {
    throw new Error(
      `Task claim field '${name}' must be TEXT; found '${field.dataType}'`,
    );
  }

  return field.id;
}

export function resolveTaskClaimTarget(input: {
  readonly project: ProjectSnapshot;
  readonly workItems: readonly ProjectWorkItemSnapshot[];
  readonly workNumber: number;
}): TaskClaimTarget {
  if (input.project.closed) {
    throw new Error(`Project #${input.project.number} is closed`);
  }

  const workMatches = input.workItems.filter(
    (item) => item.issueNumber === input.workNumber,
  );
  if (workMatches.length !== 1) {
    throw new Error(
      `Work #${input.workNumber} must resolve to exactly one Project item; found ${workMatches.length}`,
    );
  }
  const work = workMatches[0];
  if (!work) {
    throw new Error(`Work #${input.workNumber} resolution invariant violated`);
  }

  const fieldIds: TaskClaimFieldIds = {
    activeTask: resolveTextFieldId(
      input.project,
      taskClaimFieldNames.activeTask,
    ),
    claimant: resolveTextFieldId(input.project, taskClaimFieldNames.claimant),
    generation: resolveTextFieldId(
      input.project,
      taskClaimFieldNames.generation,
    ),
    run: resolveTextFieldId(input.project, taskClaimFieldNames.run),
    acquiredAt: resolveTextFieldId(
      input.project,
      taskClaimFieldNames.acquiredAt,
    ),
  };

  return {
    projectId: input.project.id,
    projectItemId: work.projectItemId,
    fieldIds,
  };
}
