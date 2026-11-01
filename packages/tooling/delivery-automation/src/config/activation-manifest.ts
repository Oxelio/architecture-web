import type { OperationalOwnerActivation } from "../github/github-operational-state.js";

export const activationMappingNames = [
  "workState",
  "workType",
  "workflowDepth",
  "priority",
  "characteristics",
  "routes",
  "dependencies",
  "taskParent",
  "taskClaim",
  "workIntegrationPr",
] as const;

export type ActivationMappingName = (typeof activationMappingNames)[number];

export type ActivationMapping =
  | { readonly status: "inactive" }
  | { readonly status: "verified"; readonly evidenceRef: string };

export interface ActivationProjectLocator {
  readonly owner: string;
  readonly number: number;
}

export interface DeliveryActivationManifest {
  readonly schemaVersion: 1;
  readonly policyOwner: "docs/project/delivery-pipeline.md";
  readonly project: ActivationProjectLocator | null;
  readonly mappings: Readonly<Record<ActivationMappingName, ActivationMapping>>;
}

const projectBackedMappings = new Set<ActivationMappingName>([
  "workState",
  "workType",
  "workflowDepth",
  "priority",
  "taskClaim",
]);

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(record).toSorted((a, b) => {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  });
  const wanted = [...expected].toSorted((a, b) => {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  });
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(`${path} must contain exactly: ${wanted.join(", ")}`);
  }
}

function parseMapping(value: unknown, path: string): ActivationMapping {
  const record = expectRecord(value, path);
  const status = record["status"];

  if (status === "inactive") {
    exactKeys(record, ["status"], path);
    return { status };
  }

  if (status === "verified") {
    exactKeys(record, ["status", "evidenceRef"], path);
    const evidenceRef = record["evidenceRef"];
    if (typeof evidenceRef !== "string" || evidenceRef.trim().length === 0) {
      throw new Error(`${path}.evidenceRef must be a non-empty string`);
    }
    return { status, evidenceRef: evidenceRef.trim() };
  }

  throw new Error(`${path}.status must be 'inactive' or 'verified'`);
}

function parseProject(value: unknown): ActivationProjectLocator | null {
  if (value === null) {
    return null;
  }
  const record = expectRecord(value, "project");
  exactKeys(record, ["owner", "number"], "project");
  const owner = record["owner"];
  const number = record["number"];
  if (typeof owner !== "string" || owner.trim().length === 0) {
    throw new Error("project.owner must be a non-empty string");
  }
  if (!Number.isInteger(number) || (number as number) <= 0) {
    throw new Error("project.number must be a positive integer");
  }
  return { owner: owner.trim(), number: number as number };
}

export function parseActivationManifest(
  value: unknown,
): DeliveryActivationManifest {
  const root = expectRecord(value, "activation manifest");
  exactKeys(
    root,
    ["schemaVersion", "policyOwner", "project", "mappings"],
    "activation manifest",
  );

  if (root["schemaVersion"] !== 1) {
    throw new Error("activation manifest schemaVersion must be 1");
  }
  if (root["policyOwner"] !== "docs/project/delivery-pipeline.md") {
    throw new Error(
      "activation manifest policyOwner must reference docs/project/delivery-pipeline.md",
    );
  }

  const project = parseProject(root["project"]);
  const rawMappings = expectRecord(root["mappings"], "mappings");
  exactKeys(rawMappings, activationMappingNames, "mappings");

  const mappings = Object.fromEntries(
    activationMappingNames.map((name) => [
      name,
      parseMapping(rawMappings[name], `mappings.${name}`),
    ]),
  ) as Record<ActivationMappingName, ActivationMapping>;

  for (const name of projectBackedMappings) {
    if (mappings[name].status === "verified" && project === null) {
      throw new Error(
        `mappings.${name} cannot be verified without an explicit Project locator`,
      );
    }
  }

  return {
    schemaVersion: 1,
    policyOwner: "docs/project/delivery-pipeline.md",
    project,
    mappings,
  };
}

export function operationalOwnerActivation(
  manifest: DeliveryActivationManifest,
): OperationalOwnerActivation {
  return {
    workState: manifest.mappings.workState.status === "verified",
    priority: manifest.mappings.priority.status === "verified",
    routes: manifest.mappings.routes.status === "verified",
    dependencies: manifest.mappings.dependencies.status === "verified",
    taskParent: manifest.mappings.taskParent.status === "verified",
    taskClaim: manifest.mappings.taskClaim.status === "verified",
    workIntegrationPr:
      manifest.mappings.workIntegrationPr.status === "verified",
  };
}

export function activationBlockers(
  manifest: DeliveryActivationManifest,
): readonly string[] {
  const blockers = activationMappingNames
    .filter((name) => manifest.mappings[name].status !== "verified")
    .map((name) => `OWNER_INACTIVE:${name}`);
  if (manifest.project === null) {
    return ["PROJECT_LOCATOR_INACTIVE", ...blockers];
  }
  return blockers;
}
