import { describe, expect, it } from "vitest";

import type { WorkGateEvaluationGrant } from "../github/work-merge-publisher.js";
import {
  authorizeWorkIntegrationEvaluation,
  type WorkIntegrationContext,
} from "./work-integration-request.js";

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const context: WorkIntegrationContext = {
  repository: "Oxelio/architecture-web",
  repositoryId: 1336937640,
  actorId: 83680141,
  ref: "refs/heads/main",
  workflowSha: candidate.baseSha,
  runAttempt: "1",
};
const now = Date.parse("2026-11-12T12:00:00Z");
const grant: WorkGateEvaluationGrant = {
  ...candidate,
  repositoryId: context.repositoryId,
  actorId: context.actorId,
  purpose: "evaluate-work-merge-gate",
  expiresAt: "2026-11-12T12:05:00Z",
  evidence: [],
  requiredTasks: [],
  requiredEvidence: [],
  gateAppId: 5625775,
  rulesetId: 21839336,
};
const manualRequest = {
  kind: "maintainer-dispatch",
  candidate,
  grant,
} as const;

describe("Work integration evaluation authority", () => {
  it("preserves a protected manual grant for the exact candidate", () => {
    expect(
      authorizeWorkIntegrationEvaluation(context, manualRequest, now),
    ).toBe(grant);
  });

  it("treats the standing route as inactive by default", () => {
    expect(
      authorizeWorkIntegrationEvaluation(
        context,
        { kind: "standing", candidate },
        now,
      ),
    ).toBeNull();
  });

  it.each<Partial<WorkIntegrationContext>>([
    { ref: "refs/heads/feature" },
    { runAttempt: "2" },
    { repository: "someone/architecture-web" },
    { repositoryId: 1 },
    { actorId: 1 },
    { workflowSha: "c".repeat(40) },
  ])("rejects untrusted execution context %j", (override) => {
    expect(
      authorizeWorkIntegrationEvaluation(
        { ...context, ...override },
        manualRequest,
        now,
      ),
    ).toBeNull();
  });

  it("rejects a missing, expired or differently scoped grant", () => {
    const invalidGrants = [
      null,
      { ...grant, expiresAt: "2026-11-12T12:00:00Z" },
      { ...grant, headSha: "c".repeat(40) },
      { ...grant, pullNumber: 142 },
      { ...grant, direct: false },
      { ...grant, auto: false },
    ];
    for (const invalid of invalidGrants) {
      expect(
        authorizeWorkIntegrationEvaluation(
          context,
          { ...manualRequest, grant: invalid },
          now,
        ),
      ).toBeNull();
    }
  });
});
