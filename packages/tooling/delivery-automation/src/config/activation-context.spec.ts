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

function inventory(): GitHubInventorySnapshot {
  return {
    labels: ["agent:human"],
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
            id: "work-state",
            name: "Work State",
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
      workState: { status: "verified", evidenceRef: "validation:work-state" },
      priority: { status: "verified", evidenceRef: "validation:priority" },
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

describe("resolveActivationContext", () => {
  it("blocks when no Project locator has been activated", () => {
    const manifest = parseActivationManifest({
      schemaVersion: 1,
      policyOwner: "docs/project/delivery-pipeline.md",
      project: null,
      mappings: {
        workState: { status: "inactive" },
        priority: { status: "inactive" },
        routes: { status: "inactive" },
        dependencies: { status: "inactive" },
        taskParent: { status: "inactive" },
        taskClaim: { status: "inactive" },
        workIntegrationPr: { status: "inactive" },
      },
    });

    expect(
      resolveActivationContext({
        repository: "Oxelio/Architecture-Web",
        manifest,
        inventory: inventory(),
      }),
    ).toEqual({ status: "blocked", blockers: ["PROJECT_LOCATOR_INACTIVE"] });
  });

  it("revalidates verified mappings without requiring a provider-specific route", () => {
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

  it("fails closed if the reserved human route label drifts after activation", () => {
    const snapshot = inventory();
    const result = resolveActivationContext({
      repository: "Oxelio/Architecture-Web",
      manifest: verifiedManifest(),
      inventory: { ...snapshot, labels: [] },
    });

    expect(result).toEqual({
      status: "blocked",
      blockers: ["MAPPING_DRIFT:routes:required-labels"],
    });
  });
});
