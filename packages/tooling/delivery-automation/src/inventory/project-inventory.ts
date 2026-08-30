import type {
  DeliveryExpectations,
  DeliveryFieldExpectation,
} from "./delivery-expectations.js";

export interface ProjectFieldSnapshot {
  readonly id: string;
  readonly name: string;
  readonly dataType: string;
  readonly options?: readonly string[];
}

export interface ProjectViewSnapshot {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly layout: string;
  readonly filter: string | null;
  readonly visibleFields: readonly string[];
  readonly groupByFields: readonly string[];
  readonly verticalGroupByFields: readonly string[];
}

export interface ProjectSnapshot {
  readonly id: string;
  readonly owner: string;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly closed: boolean;
  readonly repositories: readonly string[];
  readonly fields: readonly ProjectFieldSnapshot[];
  readonly views: readonly ProjectViewSnapshot[];
}

export interface ExplicitProjectLocator {
  readonly owner: string;
  readonly number: number;
}

export type ProjectSelectionBlocker =
  | "NO_LINKED_PROJECT"
  | "AMBIGUOUS_LINKED_PROJECT"
  | "EXPLICIT_PROJECT_NOT_FOUND"
  | "EXPLICIT_PROJECT_NOT_LINKED";

export type ProjectSelection =
  | {
      readonly status: "selected";
      readonly source: "linked" | "explicit";
      readonly project: ProjectSnapshot;
    }
  | {
      readonly status: "blocked";
      readonly blocker: ProjectSelectionBlocker;
      readonly candidates: readonly ProjectSnapshot[];
    };

export interface FieldMismatch {
  readonly name: string;
  readonly expectedType: string;
  readonly actualType: string;
  readonly missingOptions: readonly string[];
  readonly unexpectedOptions: readonly string[];
}

export interface ViewMismatch {
  readonly name: string;
  readonly expectedLayout: string;
  readonly actualLayout: string;
}

export interface ProjectInventoryReport {
  readonly repository: string;
  readonly selection: ProjectSelection;
  readonly projectClosed: boolean;
  readonly duplicateFields: readonly string[];
  readonly duplicateViews: readonly string[];
  readonly missingFields: readonly string[];
  readonly mismatchedFields: readonly FieldMismatch[];
  readonly missingViews: readonly string[];
  readonly mismatchedViews: readonly ViewMismatch[];
  readonly missingLabels: readonly string[];
  readonly inspectionStatus: "baseline-matches" | "blocked";
}

function normalizeRepository(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOwner(value: string): string {
  return value.trim().toLowerCase();
}

function includesRepository(
  project: ProjectSnapshot,
  repository: string,
): boolean {
  const expected = normalizeRepository(repository);
  return project.repositories.some(
    (candidate) => normalizeRepository(candidate) === expected,
  );
}

function findDuplicateNames(values: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .toSorted();
}

export function selectProject(
  repository: string,
  projects: readonly ProjectSnapshot[],
  explicitProject?: ExplicitProjectLocator,
): ProjectSelection {
  if (explicitProject) {
    const project = projects.find(
      (candidate) =>
        normalizeOwner(candidate.owner) ===
          normalizeOwner(explicitProject.owner) &&
        candidate.number === explicitProject.number,
    );

    if (!project) {
      return {
        status: "blocked",
        blocker: "EXPLICIT_PROJECT_NOT_FOUND",
        candidates: [],
      };
    }

    if (!includesRepository(project, repository)) {
      return {
        status: "blocked",
        blocker: "EXPLICIT_PROJECT_NOT_LINKED",
        candidates: [project],
      };
    }

    return { status: "selected", source: "explicit", project };
  }

  const linkedProjects = projects.filter((project) =>
    includesRepository(project, repository),
  );

  if (linkedProjects.length === 0) {
    return {
      status: "blocked",
      blocker: "NO_LINKED_PROJECT",
      candidates: [],
    };
  }

  if (linkedProjects.length > 1) {
    return {
      status: "blocked",
      blocker: "AMBIGUOUS_LINKED_PROJECT",
      candidates: linkedProjects.toSorted(
        (left, right) => left.number - right.number,
      ),
    };
  }

  const [project] = linkedProjects;
  if (!project) {
    throw new Error("Project selection invariant violated");
  }

  return { status: "selected", source: "linked", project };
}

function compareOptions(
  expected: DeliveryFieldExpectation,
  actual: ProjectFieldSnapshot,
): Pick<FieldMismatch, "missingOptions" | "unexpectedOptions"> {
  if (!expected.options) {
    return { missingOptions: [], unexpectedOptions: [] };
  }

  const actualOptions = new Set(actual.options ?? []);
  const expectedOptions = new Set(expected.options);

  return {
    missingOptions: expected.options.filter(
      (option) => !actualOptions.has(option),
    ),
    unexpectedOptions: (actual.options ?? []).filter(
      (option) => !expectedOptions.has(option),
    ),
  };
}

export function buildInventoryReport(input: {
  readonly repository: string;
  readonly projects: readonly ProjectSnapshot[];
  readonly labels: readonly string[];
  readonly expectations: DeliveryExpectations;
  readonly explicitProject?: ExplicitProjectLocator;
}): ProjectInventoryReport {
  const selection = selectProject(
    input.repository,
    input.projects,
    input.explicitProject,
  );

  const knownLabels = new Set(input.labels);
  const missingLabels = input.expectations.labels.filter(
    (label) => !knownLabels.has(label),
  );

  if (selection.status === "blocked") {
    return {
      repository: input.repository,
      selection,
      projectClosed: false,
      duplicateFields: [],
      duplicateViews: [],
      missingFields: input.expectations.fields.map((field) => field.name),
      mismatchedFields: [],
      missingViews: input.expectations.views.map((view) => view.name),
      mismatchedViews: [],
      missingLabels,
      inspectionStatus: "blocked",
    };
  }

  const duplicateFields = findDuplicateNames(
    selection.project.fields.map((field) => field.name),
  );
  const duplicateViews = findDuplicateNames(
    selection.project.views.map((view) => view.name),
  );
  const fieldsByName = new Map(
    selection.project.fields.map((field) => [field.name, field] as const),
  );
  const viewsByName = new Map(
    selection.project.views.map((view) => [view.name, view] as const),
  );
  const missingFields: string[] = [];
  const mismatchedFields: FieldMismatch[] = [];
  const missingViews: string[] = [];
  const mismatchedViews: ViewMismatch[] = [];

  for (const expectedField of input.expectations.fields) {
    const actualField = fieldsByName.get(expectedField.name);
    if (!actualField) {
      missingFields.push(expectedField.name);
      continue;
    }

    const options = compareOptions(expectedField, actualField);
    if (
      actualField.dataType !== expectedField.dataType ||
      options.missingOptions.length > 0 ||
      options.unexpectedOptions.length > 0
    ) {
      mismatchedFields.push({
        name: expectedField.name,
        expectedType: expectedField.dataType,
        actualType: actualField.dataType,
        ...options,
      });
    }
  }

  for (const expectedView of input.expectations.views) {
    const actualView = viewsByName.get(expectedView.name);
    if (!actualView) {
      missingViews.push(expectedView.name);
      continue;
    }

    if (expectedView.layout && actualView.layout !== expectedView.layout) {
      mismatchedViews.push({
        name: expectedView.name,
        expectedLayout: expectedView.layout,
        actualLayout: actualView.layout,
      });
    }
  }

  const projectClosed = selection.project.closed;
  const inspectionStatus =
    !projectClosed &&
    duplicateFields.length === 0 &&
    duplicateViews.length === 0 &&
    missingFields.length === 0 &&
    mismatchedFields.length === 0 &&
    missingViews.length === 0 &&
    mismatchedViews.length === 0 &&
    missingLabels.length === 0
      ? "baseline-matches"
      : "blocked";

  return {
    repository: input.repository,
    selection,
    projectClosed,
    duplicateFields,
    duplicateViews,
    missingFields,
    mismatchedFields,
    missingViews,
    mismatchedViews,
    missingLabels,
    inspectionStatus,
  };
}
