import { describe, expect, it } from "vitest";

import type { DeliveryExpectations } from "./delivery-expectations.js";
import {
  buildInventoryReport,
  type ProjectSnapshot,
  selectProject,
} from "./project-inventory.js";

function project(input: {
  number: number;
  repositories?: readonly string[];
  owner?: string;
  closed?: boolean;
  fields?: ProjectSnapshot["fields"];
  views?: ProjectSnapshot["views"];
}): ProjectSnapshot {
  return {
    id: `PVT_${input.number}`,
    owner: input.owner ?? "Oxelio",
    number: input.number,
    title: `Project ${input.number}`,
    url: `https://github.com/users/Oxelio/projects/${input.number}`,
    closed: input.closed ?? false,
    repositories: input.repositories ?? ["Oxelio/Architecture-Web"],
    fields: input.fields ?? [],
    views: input.views ?? [],
  };
}

const expectations: DeliveryExpectations = {
  fields: [
    {
      name: "Work State",
      dataType: "SINGLE_SELECT",
      options: ["Idea", "Ready", "Done"],
    },
  ],
  views: [{ name: "Workflow", layout: "BOARD_LAYOUT" }],
  labels: ["char:security", "agent:codex"],
};

const workStateField = {
  id: "field-state",
  name: "Work State",
  dataType: "SINGLE_SELECT",
  options: ["Idea", "Ready", "Done"],
} as const;

const workflowView = {
  id: "view-workflow",
  number: 1,
  name: "Workflow",
  layout: "BOARD_LAYOUT",
  filter: null,
  visibleFields: ["Title", "Work State"],
  groupByFields: [],
  verticalGroupByFields: ["Work State"],
} as const;

describe("selectProject", () => {
  it("blocks when no linked project exists", () => {
    const selection = selectProject("Oxelio/Architecture-Web", [
      project({ number: 1, repositories: ["Oxelio/Other"] }),
    ]);

    expect(selection).toEqual({
      status: "blocked",
      blocker: "NO_LINKED_PROJECT",
      candidates: [],
    });
  });

  it("blocks when several projects are linked", () => {
    const selection = selectProject("Oxelio/Architecture-Web", [
      project({ number: 2 }),
      project({ number: 1 }),
    ]);

    expect(selection.status).toBe("blocked");
    if (selection.status === "blocked") {
      expect(selection.blocker).toBe("AMBIGUOUS_LINKED_PROJECT");
      expect(selection.candidates.map((candidate) => candidate.number)).toEqual(
        [1, 2],
      );
    }
  });

  it("uses an explicit linked project when supplied", () => {
    const selection = selectProject(
      "Oxelio/Architecture-Web",
      [project({ number: 3 }), project({ number: 4 })],
      { owner: "oxelio", number: 4 },
    );

    expect(selection.status).toBe("selected");
    if (selection.status === "selected") {
      expect(selection.source).toBe("explicit");
      expect(selection.project.number).toBe(4);
    }
  });

  it("rejects an explicit project that is not linked", () => {
    const selection = selectProject(
      "Oxelio/Architecture-Web",
      [project({ number: 5, repositories: ["Oxelio/Other"] })],
      { owner: "Oxelio", number: 5 },
    );

    expect(selection).toMatchObject({
      status: "blocked",
      blocker: "EXPLICIT_PROJECT_NOT_LINKED",
    });
  });
});

describe("buildInventoryReport", () => {
  it("reports baseline-matches only when the expected primitives match", () => {
    const report = buildInventoryReport({
      repository: "Oxelio/Architecture-Web",
      projects: [
        project({
          number: 1,
          fields: [workStateField],
          views: [workflowView],
        }),
      ],
      labels: ["char:security", "agent:codex"],
      expectations,
    });

    expect(report.inspectionStatus).toBe("baseline-matches");
    expect(report.projectClosed).toBe(false);
    expect(report.duplicateFields).toEqual([]);
    expect(report.duplicateViews).toEqual([]);
    expect(report.missingFields).toEqual([]);
    expect(report.mismatchedFields).toEqual([]);
    expect(report.missingViews).toEqual([]);
    expect(report.mismatchedViews).toEqual([]);
    expect(report.missingLabels).toEqual([]);
  });

  it("blocks a closed project even when its primitives match", () => {
    const report = buildInventoryReport({
      repository: "Oxelio/Architecture-Web",
      projects: [
        project({
          number: 1,
          closed: true,
          fields: [workStateField],
          views: [workflowView],
        }),
      ],
      labels: ["char:security", "agent:codex"],
      expectations,
    });

    expect(report.inspectionStatus).toBe("blocked");
    expect(report.projectClosed).toBe(true);
  });

  it("blocks duplicate field and view names instead of silently collapsing them", () => {
    const report = buildInventoryReport({
      repository: "Oxelio/Architecture-Web",
      projects: [
        project({
          number: 1,
          fields: [
            workStateField,
            { ...workStateField, id: "field-state-duplicate" },
          ],
          views: [
            workflowView,
            { ...workflowView, id: "view-workflow-duplicate", number: 2 },
          ],
        }),
      ],
      labels: ["char:security", "agent:codex"],
      expectations,
    });

    expect(report.inspectionStatus).toBe("blocked");
    expect(report.duplicateFields).toEqual(["Work State"]);
    expect(report.duplicateViews).toEqual(["Workflow"]);
  });

  it("blocks a baseline layout mismatch without guessing view semantics", () => {
    const report = buildInventoryReport({
      repository: "Oxelio/Architecture-Web",
      projects: [
        project({
          number: 1,
          fields: [workStateField],
          views: [{ ...workflowView, layout: "TABLE_LAYOUT" }],
        }),
      ],
      labels: ["char:security", "agent:codex"],
      expectations,
    });

    expect(report.inspectionStatus).toBe("blocked");
    expect(report.mismatchedViews).toEqual([
      {
        name: "Workflow",
        expectedLayout: "BOARD_LAYOUT",
        actualLayout: "TABLE_LAYOUT",
      },
    ]);
  });

  it("reports missing and mismatched primitives without normalizing them", () => {
    const report = buildInventoryReport({
      repository: "Oxelio/Architecture-Web",
      projects: [
        project({
          number: 1,
          fields: [
            {
              id: "field-state",
              name: "Work State",
              dataType: "SINGLE_SELECT",
              options: ["Idea", "Ready", "Unexpected"],
            },
          ],
        }),
      ],
      labels: ["char:security"],
      expectations,
    });

    expect(report.inspectionStatus).toBe("blocked");
    expect(report.missingViews).toEqual(["Workflow"]);
    expect(report.missingLabels).toEqual(["agent:codex"]);
    expect(report.mismatchedFields).toEqual([
      {
        name: "Work State",
        expectedType: "SINGLE_SELECT",
        actualType: "SINGLE_SELECT",
        missingOptions: ["Done"],
        unexpectedOptions: ["Unexpected"],
      },
    ]);
  });
});
