import { taskClaimFieldNames } from "../control/task-claim.js";
import type { GitHubInventorySnapshot } from "../github/github-project-inventory.js";
import { architectureWebDeliveryExpectations } from "../inventory/delivery-expectations.js";
import {
  buildInventoryReport,
  type ExplicitProjectLocator,
  type ProjectSnapshot,
  type ProjectViewSnapshot,
  selectProject,
} from "../inventory/project-inventory.js";
import {
  activationMappingNames,
  type DeliveryActivationManifest,
} from "./activation-manifest.js";

export interface NativeCapabilityVerification {
  readonly dependencies: boolean;
  readonly taskParent: boolean;
  readonly workIntegrationPr: boolean;
}

export type ActivationVerificationBlocker =
  | "BASELINE_MISMATCH"
  | "PROJECT_NOT_SELECTED"
  | "PROJECT_CLOSED"
  | "CLAIM_FIELDS_MISSING_OR_INVALID"
  | "BACKLOG_VIEW_SEMANTICS_INVALID"
  | "READY_QUEUE_VIEW_SEMANTICS_INVALID"
  | "WORKFLOW_VIEW_SEMANTICS_INVALID"
  | "ACTIVE_VIEW_SEMANTICS_INVALID"
  | "WAITING_VIEW_SEMANTICS_INVALID"
  | "DONE_VIEW_SEMANTICS_INVALID"
  | "NATIVE_STATUS_VISIBLE"
  | "DEPENDENCY_CAPABILITY_UNVERIFIED"
  | "TASK_PARENT_CAPABILITY_UNVERIFIED"
  | "WORK_INTEGRATION_PR_CAPABILITY_UNVERIFIED";

export type ActivationVerificationResult =
  | {
      readonly status: "verified";
      readonly project: ProjectSnapshot;
      readonly manifest: DeliveryActivationManifest;
      readonly blockers: readonly [];
    }
  | {
      readonly status: "blocked";
      readonly project: ProjectSnapshot | null;
      readonly manifest: null;
      readonly blockers: readonly ActivationVerificationBlocker[];
    };

const requiredBacklogFields = [
  "Title",
  "Priority",
  "Labels",
  "Work State",
  "Work Type",
  "Workflow Depth",
  "Assignees",
] as const;

const operationalViewNames = new Set([
  "Backlog",
  "Ready Queue",
  "Workflow",
  "Active",
  "Waiting",
  "Done",
]);

interface FilterTerm {
  readonly negated: boolean;
  readonly field: string;
  readonly values: readonly string[];
}

function view(
  project: ProjectSnapshot,
  name: string,
): ProjectViewSnapshot | null {
  const matches = project.views.filter((candidate) => candidate.name === name);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function includesAll(
  values: readonly string[],
  required: readonly string[],
): boolean {
  const known = new Set(values);
  return required.every((value) => known.has(value));
}

function splitOutsideQuotes(value: string, separator: "whitespace" | ","): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;

  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      current += character;
      continue;
    }

    const isSeparator =
      separator === "," ? character === "," : /\s/u.test(character);
    if (isSeparator) {
      if (current.trim()) {
        parts.push(current.trim());
        current = "";
      }
      continue;
    }
    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function unquotedColon(value: string): number {
  let quote: "\"" | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === ":") {
      return index;
    }
  }
  return -1;
}

function normalizeFilterToken(value: string): string {
  const trimmed = value.trim();
  const unquoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed;

  return unquoted
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFilterTerms(filter: string | null): readonly FilterTerm[] {
  if (!filter?.trim()) {
    return [];
  }

  const terms: FilterTerm[] = [];
  for (const token of splitOutsideQuotes(filter, "whitespace")) {
    const negated = token.startsWith("-");
    const raw = negated ? token.slice(1) : token;
    const colon = unquotedColon(raw);
    if (colon <= 0 || colon === raw.length - 1) {
      continue;
    }

    const field = normalizeFilterToken(raw.slice(0, colon));
    const values = splitOutsideQuotes(raw.slice(colon + 1), ",")
      .map(normalizeFilterToken)
      .filter(Boolean);
    if (field && values.length > 0) {
      terms.push({ negated, field, values });
    }
  }
  return terms;
}

function hasExactPositiveFieldValues(
  viewSnapshot: ProjectViewSnapshot,
  field: string,
  expectedValues: readonly string[],
): boolean {
  const expectedField = normalizeFilterToken(field);
  const matches = parseFilterTerms(viewSnapshot.filter).filter(
    (term) => term.field === expectedField,
  );
  if (matches.length !== 1 || matches[0]?.negated) {
    return false;
  }

  const actual = new Set(matches[0].values);
  const expected = expectedValues.map(normalizeFilterToken);
  return (
    actual.size === expected.length &&
    expected.every((value) => actual.has(value))
  );
}

function hasNativeStatusVisibleInOperationalViews(
  project: ProjectSnapshot,
): boolean {
  return project.views.some(
    (candidate) =>
      operationalViewNames.has(candidate.name) &&
      candidate.visibleFields.includes("Status"),
  );
}

function verifyClaimFields(project: ProjectSnapshot): boolean {
  return Object.values(taskClaimFieldNames).every((name) => {
    const matches = project.fields.filter((field) => field.name === name);
    return matches.length === 1 && matches[0]?.dataType === "TEXT";
  });
}

function verifyViews(
  project: ProjectSnapshot,
): ActivationVerificationBlocker[] {
  const blockers: ActivationVerificationBlocker[] = [];
  const backlog = view(project, "Backlog");
  if (!backlog || !includesAll(backlog.visibleFields, requiredBacklogFields)) {
    blockers.push("BACKLOG_VIEW_SEMANTICS_INVALID");
  }

  const ready = view(project, "Ready Queue");
  if (
    !ready ||
    !hasExactPositiveFieldValues(ready, "Work State", ["Ready"]) ||
    !includesAll(ready.visibleFields, ["Priority", "Labels", "Work State"])
  ) {
    blockers.push("READY_QUEUE_VIEW_SEMANTICS_INVALID");
  }

  const workflow = view(project, "Workflow");
  if (!workflow || !workflow.groupByFields.includes("Work State")) {
    blockers.push("WORKFLOW_VIEW_SEMANTICS_INVALID");
  }

  const active = view(project, "Active");
  if (
    !active ||
    !hasExactPositiveFieldValues(active, "Work State", [
      "Preparing",
      "Ready",
      "Implementing",
      "Reviewing",
      "Validating",
    ])
  ) {
    blockers.push("ACTIVE_VIEW_SEMANTICS_INVALID");
  }

  const waiting = view(project, "Waiting");
  if (
    !waiting ||
    !hasExactPositiveFieldValues(waiting, "Work State", ["Awaiting Approval"])
  ) {
    blockers.push("WAITING_VIEW_SEMANTICS_INVALID");
  }

  const done = view(project, "Done");
  if (
    !done ||
    !hasExactPositiveFieldValues(done, "Work State", ["Done"])
  ) {
    blockers.push("DONE_VIEW_SEMANTICS_INVALID");
  }

  if (hasNativeStatusVisibleInOperationalViews(project)) {
    blockers.push("NATIVE_STATUS_VISIBLE");
  }

  return blockers;
}

function verifiedMappings(
  evidenceRef: string,
): DeliveryActivationManifest["mappings"] {
  const mapping = { status: "verified" as const, evidenceRef };
  return Object.fromEntries(
    activationMappingNames.map((name) => [name, mapping]),
  ) as DeliveryActivationManifest["mappings"];
}

export function verifyDeliveryActivation(input: {
  readonly repository: string;
  readonly inventory: GitHubInventorySnapshot;
  readonly nativeCapabilities: NativeCapabilityVerification;
  readonly evidenceRef: string;
  readonly explicitProject?: ExplicitProjectLocator;
}): ActivationVerificationResult {
  if (!input.evidenceRef.trim()) {
    throw new Error("Activation evidenceRef must be non-empty");
  }

  const report = buildInventoryReport({
    repository: input.repository,
    projects: input.inventory.projects,
    labels: input.inventory.labels,
    expectations: architectureWebDeliveryExpectations,
    ...(input.explicitProject
      ? { explicitProject: input.explicitProject }
      : {}),
  });
  const selection = selectProject(
    input.repository,
    input.inventory.projects,
    input.explicitProject,
  );
  const project = selection.status === "selected" ? selection.project : null;
  const blockers: ActivationVerificationBlocker[] = [];

  if (report.inspectionStatus !== "baseline-matches") {
    blockers.push("BASELINE_MISMATCH");
  }
  if (!project) {
    blockers.push("PROJECT_NOT_SELECTED");
  } else {
    if (project.closed) {
      blockers.push("PROJECT_CLOSED");
    }
    if (!verifyClaimFields(project)) {
      blockers.push("CLAIM_FIELDS_MISSING_OR_INVALID");
    }
    blockers.push(...verifyViews(project));
  }

  if (!input.nativeCapabilities.dependencies) {
    blockers.push("DEPENDENCY_CAPABILITY_UNVERIFIED");
  }
  if (!input.nativeCapabilities.taskParent) {
    blockers.push("TASK_PARENT_CAPABILITY_UNVERIFIED");
  }
  if (!input.nativeCapabilities.workIntegrationPr) {
    blockers.push("WORK_INTEGRATION_PR_CAPABILITY_UNVERIFIED");
  }

  if (blockers.length > 0 || !project) {
    return { status: "blocked", project, manifest: null, blockers };
  }

  return {
    status: "verified",
    project,
    blockers: [],
    manifest: {
      schemaVersion: 1,
      policyOwner: "docs/project/delivery-pipeline.md",
      project: { owner: project.owner, number: project.number },
      mappings: verifiedMappings(input.evidenceRef.trim()),
    },
  };
}
