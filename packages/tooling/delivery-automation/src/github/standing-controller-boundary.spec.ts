import { describe, expect, it } from "vitest";

import { matchesStandingControllerBoundary } from "./standing-controller-boundary.js";

const scope = {
  repositoryId: 1336937640,
  projectId: "the-active-project",
  controllerInstallationId: 42,
  checksInstallationId: 57,
  sources: {
    ".github": "a".repeat(40),
    "pnpm-lock.yaml": "b".repeat(40),
    "packages/tooling/delivery-automation": "c".repeat(40),
  },
};
const candidate = {
  workNumber: 42,
  pullNumber: 43,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const use = {
  mode: "standing",
  candidate,
  now: Date.parse("2026-11-17T10:00:00Z"),
} as const;
const proof = {
  kind: "standing-work-controller-boundary",
  mode: "standing",
  ...scope,
  validatedWriters: [
    "project-state",
    "tasks-dependencies",
    "review-decision-records",
    "pr-head-base",
    "gate-issuer",
    "journal-refs",
    "delegation",
  ],
  validationRef: "https://github.com/Oxelio/architecture-web/actions/runs/115",
  journalCreationRulesetId: 1,
  journalImmutabilityRulesetId: 2,
  mergeRulesetId: 3,
  rulesetObservations: [],
  evidenceAuthority: {},
} as const;

describe("the deployed controller activation boundary", () => {
  it("matches the independently validated deployment and exact sources", () => {
    expect(matchesStandingControllerBoundary(proof, scope, use)).toBe(true);
  });

  it("permits supervised operation for one exact candidate before the scheduled expiry", () => {
    const supervised = {
      ...proof,
      mode: "supervised",
      candidate,
      expiresAt: "2026-11-17T11:00:00Z",
    } as const;
    const validation = { ...use, mode: "supervised" } as const;
    expect(
      matchesStandingControllerBoundary(supervised, scope, validation),
    ).toBe(true);
    expect(matchesStandingControllerBoundary(supervised, scope, use)).toBe(
      false,
    );
    expect(
      matchesStandingControllerBoundary(supervised, scope, {
        ...validation,
        candidate: { ...candidate, pullNumber: 44 },
      }),
    ).toBe(false);
    expect(
      matchesStandingControllerBoundary(supervised, scope, {
        ...validation,
        now: Date.parse(supervised.expiresAt),
      }),
    ).toBe(false);
  });

  it.each([
    null,
    { ...proof, sources: { ...scope.sources, ".github": "d".repeat(40) } },
    { ...proof, checksInstallationId: 99 },
    { ...proof, validatedWriters: ["gate-issuer"] },
    { ...proof, validationRef: "https://example.org/115" },
    { ...proof, mergeRulesetId: 2 },
  ])("fails closed on missing proof or drift (%s)", (record) => {
    expect(matchesStandingControllerBoundary(record, scope, use)).toBe(false);
  });
});
