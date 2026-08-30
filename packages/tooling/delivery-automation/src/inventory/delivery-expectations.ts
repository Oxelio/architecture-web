export interface DeliveryFieldExpectation {
  readonly name: string;
  readonly dataType: "SINGLE_SELECT";
  readonly options?: readonly string[];
}

export interface DeliveryViewExpectation {
  readonly name: string;
  readonly layout?: "TABLE_LAYOUT" | "BOARD_LAYOUT";
}

export interface DeliveryExpectations {
  readonly fields: readonly DeliveryFieldExpectation[];
  readonly views: readonly DeliveryViewExpectation[];
  readonly labels: readonly string[];
}

/**
 * Executable representation derived from docs/project/delivery-pipeline.md.
 * The Markdown governance document remains the normative owner; this value is
 * validation/enforcement configuration and must be synchronized when policy changes.
 *
 * Only view properties that the policy states unambiguously are encoded here.
 * Filters, visible fields, grouping and sorting are inventoried and are verified
 * during the separate activation task rather than guessed by this baseline.
 */
export const architectureWebDeliveryExpectations: DeliveryExpectations = {
  fields: [
    {
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
      name: "Workflow Depth",
      dataType: "SINGLE_SELECT",
      options: ["Quick", "Standard", "Complex"],
    },
    {
      name: "Priority",
      dataType: "SINGLE_SELECT",
      options: ["P0 — Critical", "P1 — High", "P2 — Normal", "P3 — Low"],
    },
  ],
  views: [
    { name: "Backlog", layout: "TABLE_LAYOUT" },
    { name: "Ready Queue", layout: "TABLE_LAYOUT" },
    { name: "Workflow", layout: "BOARD_LAYOUT" },
    { name: "Active" },
    { name: "Waiting" },
    { name: "Done", layout: "TABLE_LAYOUT" },
  ],
  labels: [
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
  ],
};
