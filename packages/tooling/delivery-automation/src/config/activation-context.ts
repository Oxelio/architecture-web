import { taskClaimFieldNames } from "../control/task-claim.js";
import type { GitHubInventorySnapshot } from "../github/github-project-inventory.js";
import {
  type ProjectFieldSnapshot,
  type ProjectSnapshot,
  selectProject,
} from "../inventory/project-inventory.js";
import {
  type ActivationMappingName,
  type DeliveryActivationManifest,
  operationalOwnerActivation,
} from "./activation-manifest.js";

export type ActivationContextBlocker =
  | "PROJECT_LOCATOR_INACTIVE"
  | "PROJECT_NOT_RESOLVED"
  | "PROJECT_CLOSED"
  | `MAPPING_DRIFT:${ActivationMappingName}:${string}`;

export type ActivationContextResolution =
  | {
      readonly status: "ready";
      readonly project: ProjectSnapshot;
      readonly activation: ReturnType<typeof operationalOwnerActivation>;
    }
  | {
      readonly status: "blocked";
      readonly blockers: readonly ActivationContextBlocker[];
    };

function exactField(
  project: ProjectSnapshot,
  name: string,
): ProjectFieldSnapshot | null {
  const matches = project.fields.filter((field) => field.name === name);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function verifySingleSelect(
  project: ProjectSnapshot,
  mapping: ActivationMappingName,
  name: string,
  expectedOptions: readonly string[],
): ActivationContextBlocker[] {
  const field = exactField(project, name);
  if (!field) {
    return [`MAPPING_DRIFT:${mapping}:field-cardinality`];
  }
  if (field.dataType !== "SINGLE_SELECT") {
    return [`MAPPING_DRIFT:${mapping}:field-type`];
  }

  const actual = new Set(field.options ?? []);
  if (
    actual.size !== expectedOptions.length ||
    expectedOptions.some((option) => !actual.has(option))
  ) {
    return [`MAPPING_DRIFT:${mapping}:field-options`];
  }
  return [];
}

function verifyTaskClaim(project: ProjectSnapshot): ActivationContextBlocker[] {
  for (const name of Object.values(taskClaimFieldNames)) {
    const field = exactField(project, name);
    if (!field) {
      return ["MAPPING_DRIFT:taskClaim:field-cardinality"];
    }
    if (field.dataType !== "TEXT") {
      return ["MAPPING_DRIFT:taskClaim:field-type"];
    }
  }
  return [];
}

function verifyRoutes(labels: readonly string[]): ActivationContextBlocker[] {
  const known = new Set(labels);
  return known.has("agent:human") && known.has("agent:codex")
    ? []
    : ["MAPPING_DRIFT:routes:required-labels"];
}

export function resolveActivationContext(input: {
  readonly repository: string;
  readonly manifest: DeliveryActivationManifest;
  readonly inventory: GitHubInventorySnapshot;
}): ActivationContextResolution {
  const locator = input.manifest.project;
  if (!locator) {
    return { status: "blocked", blockers: ["PROJECT_LOCATOR_INACTIVE"] };
  }

  const selection = selectProject(
    input.repository,
    input.inventory.projects,
    locator,
  );
  if (selection.status !== "selected") {
    return { status: "blocked", blockers: ["PROJECT_NOT_RESOLVED"] };
  }
  if (selection.project.closed) {
    return { status: "blocked", blockers: ["PROJECT_CLOSED"] };
  }

  const activation = operationalOwnerActivation(input.manifest);
  const blockers: ActivationContextBlocker[] = [];

  if (activation.workState) {
    blockers.push(
      ...verifySingleSelect(selection.project, "workState", "Work State", [
        "Idea",
        "Exploring",
        "Designing",
        "Awaiting Approval",
        "Preparing",
        "Ready",
        "Implementing",
        "Reviewing",
        "Validating",
        "Done",
      ]),
    );
  }

  if (activation.priority) {
    blockers.push(
      ...verifySingleSelect(selection.project, "priority", "Priority", [
        "P0 — Critical",
        "P1 — High",
        "P2 — Normal",
        "P3 — Low",
      ]),
    );
  }

  if (activation.taskClaim) {
    blockers.push(...verifyTaskClaim(selection.project));
  }

  if (activation.routes) {
    blockers.push(...verifyRoutes(input.inventory.labels));
  }

  if (blockers.length > 0) {
    return { status: "blocked", blockers };
  }

  return { status: "ready", project: selection.project, activation };
}
