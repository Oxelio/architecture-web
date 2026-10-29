import { describe, expect, it } from "vitest";

import { taskClaimFieldNames } from "../control/task-claim.js";
import type { GitHubInventorySnapshot } from "../github/github-project-inventory.js";
import type { ProjectSnapshot } from "../inventory/project-inventory.js";
import { activationMappingNames } from "./activation-manifest.js";
import { verifyDeliveryActivation } from "./activation-verification.js";

const workStates = [
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
] as const;

const project: ProjectSnapshot = {
  id: "PVT_1",
  owner: "Oxelio",
  number: 1,
  title: "Architecture Web",
  url: "https://github.com/users/Oxelio/projects/1",
  closed: false,
  repositories: ["Oxelio/Architecture-Web"],
  fields: [
    { id: "TITLE", name: "Title", dataType: "TITLE" },
    { id: "ASSIGNEES", name: "Assignees", dataType: "ASSIGNEES" },
    { id: "LABELS", name: "Labels", dataType: "LABELS" },
    {
      id: "LINKED",
      name: "Linked pull requests",
      dataType: "LINKED_PULL_REQUESTS",
    },
    { id: "SUB", name: "Sub-issues progress", dataType: "SUB_ISSUES_PROGRESS" },
    {
      id: "STATUS",
      name: "Status",
      dataType: "SINGLE_SELECT",
      options: workStates,
    },
    {
      id: "WT",
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
      id: "DEPTH",
      name: "Workflow Depth",
      dataType: "SINGLE_SELECT",
      options: ["Quick", "Standard", "Complex"],
    },
    {
      id: "PRIORITY",
      name: "Priority",
      dataType: "SINGLE_SELECT",
      options: ["P0 — Critical", "P1 — High", "P2 — Normal", "P3 — Low"],
    },
    ...Object.values(taskClaimFieldNames).map((name, index) => ({
      id: `CLAIM_${index}`,
      name,
      dataType: "TEXT",
    })),
  ],
  views: [
    {
      id: "V1",
      number: 1,
      name: "Backlog",
      layout: "TABLE_LAYOUT",
      filter: null,
      visibleFields: [
        "Title",
        "Priority",
        "Labels",
        "Status",
        "Work Type",
        "Workflow Depth",
        "Assignees",
      ],
      groupByFields: [],
      verticalGroupByFields: [],
    },
    {
      id: "V2",
      number: 2,
      name: "Ready Queue",
      layout: "TABLE_LAYOUT",
      filter: "status:Ready",
      visibleFields: ["Title", "Priority", "Labels", "Status"],
      groupByFields: [],
      verticalGroupByFields: [],
    },
    {
      id: "V3",
      number: 3,
      name: "Workflow",
      layout: "BOARD_LAYOUT",
      filter: null,
      visibleFields: ["Title", "Priority", "Labels", "Status"],
      groupByFields: ["Status"],
      verticalGroupByFields: [],
    },
    {
      id: "V4",
      number: 4,
      name: "Active",
      layout: "TABLE_LAYOUT",
      filter: "status:Preparing,Ready,Implementing,Reviewing,Validating",
      visibleFields: ["Title", "Priority", "Labels", "Status"],
      groupByFields: [],
      verticalGroupByFields: [],
    },
    {
      id: "V5",
      number: 5,
      name: "Waiting",
      layout: "TABLE_LAYOUT",
      filter: 'Status:"Awaiting Approval"',
      visibleFields: ["Title", "Priority", "Labels", "Status"],
      groupByFields: [],
      verticalGroupByFields: [],
    },
    {
      id: "V6",
      number: 6,
      name: "Done",
      layout: "TABLE_LAYOUT",
      filter: "status:Done",
      visibleFields: ["Title", "Priority", "Labels", "Status"],
      groupByFields: [],
      verticalGroupByFields: [],
    },
  ],
};

const labels = [
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
  "agent:human",
] as const;

function inventory(
  projectOverride: ProjectSnapshot = project,
): GitHubInventorySnapshot {
  return { projects: [projectOverride], labels };
}

const nativeCapabilities = {
  dependencies: true,
  taskParent: true,
  workIntegrationPr: true,
} as const;

describe("verifyDeliveryActivation", () => {
  it("produces a fully verified manifest only after all backing state is verified", () => {
    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(),
      nativeCapabilities,
      evidenceRef: "issue:9#activation-evidence",
    });

    expect(result.status).toBe("verified");
    if (result.status !== "verified") {
      throw new Error("expected verified result");
    }
    expect(result.manifest.project).toEqual({ owner: "Oxelio", number: 1 });
    expect(Object.values(result.manifest.mappings)).toEqual(
      Array.from({ length: activationMappingNames.length }, () => ({
        status: "verified",
        evidenceRef: "issue:9#activation-evidence",
      })),
    );
  });

  it("blocks when Status does not expose exactly the Method Work State values", () => {
    const invalidStatus = {
      ...project,
      fields: project.fields.map((field) =>
        field.name === "Status"
          ? { ...field, options: ["Todo", "In Progress", "Done"] }
          : field,
      ),
    };

    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(invalidStatus),
      nativeCapabilities,
      evidenceRef: "evidence",
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      throw new Error("expected blocked result");
    }
    expect(result.blockers).toContain("BASELINE_MISMATCH");
  });

  it("blocks when claim fields are not present as unique TEXT fields", () => {
    const withoutClaim = {
      ...project,
      fields: project.fields.filter(
        (field) => field.name !== taskClaimFieldNames.run,
      ),
    };

    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(withoutClaim),
      nativeCapabilities,
      evidenceRef: "evidence",
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      throw new Error("expected blocked result");
    }
    expect(result.blockers).toContain("CLAIM_FIELDS_MISSING_OR_INVALID");
  });

  it("rejects a negated Ready Queue filter", () => {
    const invalidReady = {
      ...project,
      views: project.views.map((candidate) =>
        candidate.name === "Ready Queue"
          ? { ...candidate, filter: "-status:Ready" }
          : candidate,
      ),
    };

    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(invalidReady),
      nativeCapabilities,
      evidenceRef: "evidence",
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      throw new Error("expected blocked result");
    }
    expect(result.blockers).toContain("READY_QUEUE_VIEW_SEMANTICS_INVALID");
  });

  it("rejects free text that merely contains the expected Waiting words", () => {
    const invalidWaiting = {
      ...project,
      views: project.views.map((candidate) =>
        candidate.name === "Waiting"
          ? { ...candidate, filter: "Status Awaiting Approval" }
          : candidate,
      ),
    };

    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(invalidWaiting),
      nativeCapabilities,
      evidenceRef: "evidence",
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      throw new Error("expected blocked result");
    }
    expect(result.blockers).toContain("WAITING_VIEW_SEMANTICS_INVALID");
  });

  it("blocks when a native operational capability has not been verified", () => {
    const result = verifyDeliveryActivation({
      repository: "Oxelio/Architecture-Web",
      inventory: inventory(),
      nativeCapabilities: { ...nativeCapabilities, taskParent: false },
      evidenceRef: "evidence",
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") {
      throw new Error("expected blocked result");
    }
    expect(result.blockers).toContain("TASK_PARENT_CAPABILITY_UNVERIFIED");
  });
});
