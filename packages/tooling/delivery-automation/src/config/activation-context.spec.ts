import { describe, expect, it } from "vitest";

import type { GitHubInventorySnapshot } from "../github/github-project-inventory.js";
import { resolveActivationContext } from "./activation-context.js";
import { parseActivationManifest } from "./activation-manifest.js";

const claimFields = [
  "Active Task",
  "Execution Claimant",
  "Execution Claim Generation",
  "Execution Claim Run",
  "Execution Claim Acquired At",
] as const;

const characteristicLabels = [
  "char:security",
  "char:privacy",
  "char:migration",
  "char:breaking",
  "char:performance",
  "char:cross-system",
  "char:concurrency",
  "char:destructive",
  "char:operational",
  "char:compliance",
] as const;

function inventory(): GitHubInventorySnapshot {
  return {
    labels: [...characteristicLabels, "agent:human"],
    projects: [
      {
        id: "PVT_project",
        owner: "Oxelio",
        number: 1,
        title: "Architecture Web",
        url: "https://github.com/users/Oxelio/projects/1",
        closed: false,
        repositories: ["Oxelio/Architecture-Web"],
        fields: [
          {
            id: "status",
            name: "Status",
            dataType: "SINGLE_SELECT",
            options: [
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
            ],
          },
          {
            id: "work-type",
            name: "Work Type",
            dataType: "SINGLE_SELECT",
            options: [
              "Product Behavior Change",
              "Defect Correction",
              "Technical Change",
              "Architecture Change",
              "Research / Discovery",
              "Governance Change",
              "Documentation-only Change",
            ],
          },
          {
            id: "workflow-depth",
            name: "Workflow Depth",
            dataType: "SINGLE_SELECT",
            options: ["Quick", "Standard", "Complex"],
          },
          {
            id: "priority",
            name: "Priority",
            dataType: "SINGLE_SELECT",
            options: ["P0 — Critical", "P1 — High", "P2 — Normal", "P3 — Low"],
          },
          ...claimFields.map((name, index) => ({
            id: `claim-${index}`,
            name,
            dataType: "TEXT",
          })),
        ],
        views: [],
      },
    ],
  };
}

function verifiedManifest(): ReturnType<typeof parseActivationManifest> {
  return parseActivationManifest({
    schemaVersion: 1,
    policyOwner: "docs/project/delivery-pipeline.md",
    project: { owner: "Oxelio", number: 1 },
    mappings: {
      workState: { status: "verified", evidenceRef: "validation:status" },
      workType: { status: "verified", evidenceRef: "validation:work-type" },
      workflowDepth: {
        status: "verified",
        evidenceRef: "validation:workflow-depth",
      },
      priority: { status: "verified", evidenceRef: "validation:priority" },
      characteristics: {
        status: "verified",
        evidenceRef: "validation:characteristics",
      },
      routes: { status: "verified", evidenceRef: "validation:routes" },
      dependencies: {
        status: "verified",
        evidenceRef: "validation:dependencies",
      },
      taskParent: { status: "verified", evidenceRef: "validation:task-parent" },
      taskClaim: { status: "verified", evidenceRef: "validation:claim" },
      workIntegrationPr: { status: "verified", evidenceRef: "validation:pr" },
    },
  });
}

function inactiveMappings() {
  return {
    workState: { status: "inactive" as const },
    workType: { status: "inactive" as const },
    workflowDepth: { status: "inactive" as const },
    priority: { status: "inactive" as const },
    characteristics: { status: "inactive" as const },
    routes: { status: "inactive" as const },
    dependencies: { status: "inactive" as const },
    taskParent: { status: "inactive" as const },
    taskClaim: { status: "inactive" as const },
    workIntegrationPr: { status: "inactive" as const },
  };
}

describe("resolveActivationContext", () => {
  it("blocks when no Project locator has been activated", () => {
    const manifest = parseActivationManifest({
      schemaVersion: 1,
      policyOwner: "docs/project/delivery-pipeline.md",
      project: null,
      mappings: inactiveMappings(),
    });

    expect(
      resolveActivationContext({
        repository: "Oxelio/Architecture-Web",
        manifest,
        inventory: inventory(),
      }),
    ).toEqual({ status: "blocked", blockers: ["PROJECT_LOCATOR_INACTIVE"] });
  });

  it("revalidates all verified classification, routing and claim mappings", () => {
    const result = resolveActivationContext({
      repository: "Oxelio/Architecture-Web",
      manifest: verifiedManifest(),
      inventory: inventory(),
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.project.id).toBe("PVT_project");
      expect(result.activation.taskClaim).toBe(true);
      expect(result.activation.routes).toBe(true);
    }
  });

  it("fails closed if the verified Status lifecycle mapping drifts after activation", () => {
    const snapshot = inventory();
    const project = snapshot.projects[0];
    if (!project) {
      throw new Error("test project missing");
    }
    const drifted: GitHubInventorySnapshot = {
      ...snapshot,
      projects: [
        {
          ...project,
          fields: project.fields.map((field) =>
            field.name === "Status"
              ? { ...field, options: ["Todo", "In Progress", "Done"] }
              : field,
          ),
        },
      ],
    };

    expect(
      resolveActivationContext({
        repository: "Oxelio/Architecture-Web",
        manifest: verifiedManifest(),
        inventory: drifted,
      }),
    ).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:workState:field-options"],
    });
  });

  it("fails closed if a verified claim field disappears after activation", () => {
    const snapshot = inventory();
    const project = snapshot.projects[0];
    if (!project) {
      throw new Error("test project missing");
    }
    const drifted: GitHubInventorySnapshot = {
      ...snapshot,
      projects: [
        {
          ...project,
          fields: project.fields.filter(
            (field) => field.name !== "Execution Claim Run",
          ),
        },
      ],
    };

    expect(
      resolveActivationContext({
        repository: "Oxelio/Architecture-Web",
        manifest: verifiedManifest(),
        inventory: drifted,
      }),
    ).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:taskClaim:field-cardinality"],
    });
  });

  it("fails closed if a verified Work Type field drifts after activation", () => {
    const snapshot = inventory();
    const project = snapshot.projects[0];
    if (!project) {
      throw new Error("test project missing");
    }
    const drifted: GitHubInventorySnapshot = {
      ...snapshot,
      projects: [
        {
          ...project,
          fields: project.fields.map((field) =>
            field.name === "Work Type"
              ? { ...field, options: ["Technical Change"] }
              : field,
          ),
        },
      ],
    };

    expect(
      resolveActivationContext({
        repository: "Oxelio/Architecture-Web",
        manifest: verifiedManifest(),
        inventory: drifted,
      }),
    ).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:workType:field-options"],
    });
  });

  it("fails closed if a verified characteristic label disappears", () => {
    const snapshot = inventory();
    const result = resolveActivationContext({
      repository: "Oxelio/Architecture-Web",
      manifest: verifiedManifest(),
      inventory: {
        ...snapshot,
        labels: snapshot.labels.filter((label) => label !== "char:security"),
      },
    });

    expect(result).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:characteristics:required-labels"],
    });
  });

  it("fails closed if the reserved human route label drifts after activation", () => {
    const snapshot = inventory();
    const result = resolveActivationContext({
      repository: "Oxelio/Architecture-Web",
      manifest: verifiedManifest(),
      inventory: {
        ...snapshot,
        labels: snapshot.labels.filter((label) => label !== "agent:human"),
      },
    });

    expect(result).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:routes:required-labels"],
    });
  });
});
