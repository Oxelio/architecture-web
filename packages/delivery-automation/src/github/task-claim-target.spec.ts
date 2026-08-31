import { describe, expect, it } from "vitest";

import type { ProjectSnapshot } from "../inventory/project-inventory.js";
import type { ProjectWorkItemSnapshot } from "./github-operational-state.js";
import { resolveTaskClaimTarget } from "./task-claim-target.js";

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "PVT_1",
    owner: "Oxelio",
    number: 1,
    title: "Architecture Web",
    url: "https://github.com/users/Oxelio/projects/1",
    closed: false,
    repositories: ["Oxelio/Architecture-Web"],
    fields: [
      { id: "F_ACTIVE", name: "Active Task", dataType: "TEXT" },
      { id: "F_CLAIMANT", name: "Execution Claimant", dataType: "TEXT" },
      {
        id: "F_GENERATION",
        name: "Execution Claim Generation",
        dataType: "TEXT",
      },
      { id: "F_RUN", name: "Execution Claim Run", dataType: "TEXT" },
      {
        id: "F_ACQUIRED",
        name: "Execution Claim Acquired At",
        dataType: "TEXT",
      },
    ],
    views: [],
    ...overrides,
  };
}

const workItems: readonly ProjectWorkItemSnapshot[] = [
  {
    projectItemId: "PVTI_9",
    issueNumber: 9,
    issueOpen: true,
    labels: [],
    fields: {},
  },
];

describe("resolveTaskClaimTarget", () => {
  it("resolves generated Project and field IDs from semantic names", () => {
    expect(
      resolveTaskClaimTarget({ project: project(), workItems, workNumber: 9 }),
    ).toEqual({
      projectId: "PVT_1",
      projectItemId: "PVTI_9",
      fieldIds: {
        activeTask: "F_ACTIVE",
        claimant: "F_CLAIMANT",
        generation: "F_GENERATION",
        run: "F_RUN",
        acquiredAt: "F_ACQUIRED",
      },
    });
  });

  it("fails closed when a required field is missing", () => {
    const missingRun = project({
      fields: project().fields.filter(
        (field) => field.name !== "Execution Claim Run",
      ),
    });

    expect(() =>
      resolveTaskClaimTarget({ project: missingRun, workItems, workNumber: 9 }),
    ).toThrow("Execution Claim Run");
  });

  it("fails closed when a claim field has the wrong type", () => {
    const wrongType = project({
      fields: project().fields.map((field) =>
        field.name === "Active Task" ? { ...field, dataType: "NUMBER" } : field,
      ),
    });

    expect(() =>
      resolveTaskClaimTarget({ project: wrongType, workItems, workNumber: 9 }),
    ).toThrow("must be TEXT");
  });
});
