import { describe, expect, it } from "vitest";

import { taskClaimFields } from "../control/task-claim.js";
import { planClaimReconciliation } from "./claim-reconciliation.js";
import type { ProjectWorkItemSnapshot } from "./github-operational-state.js";
import type { FetchLike } from "./github-project-inventory.js";

function item(
  workNumber: number,
  fields: Readonly<Record<string, string>>,
): ProjectWorkItemSnapshot {
  return {
    projectItemId: `PVTI_${workNumber}`,
    issueNumber: workNumber,
    issueOpen: true,
    labels: [],
    fields,
  };
}

function runFetch(
  statusByRun: Readonly<Record<string, string | undefined>>,
): FetchLike {
  return async (input) => {
    const runId = String(input).split("/").at(-1) ?? "";
    const status = statusByRun[runId];
    if (status === undefined) {
      return new Response("", { status: 404 });
    }
    return new Response(JSON.stringify({ status }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("planClaimReconciliation", () => {
  it("releases only automated claims whose associated run is terminal", async () => {
    const items = [
      item(
        9,
        taskClaimFields({
          taskNumber: 42,
          claimant: "agent:codex",
          generation: "g-1",
          runId: "100",
          acquiredAt: "2026-08-29T18:00:00Z",
        }),
      ),
      item(
        10,
        taskClaimFields({
          taskNumber: 43,
          claimant: "agent:codex",
          generation: "g-2",
          runId: "101",
          acquiredAt: "2026-08-29T18:00:00Z",
        }),
      ),
    ];

    await expect(
      planClaimReconciliation({
        repository: "Oxelio/Architecture-Web",
        repositoryToken: "token",
        items,
        fetchImpl: runFetch({ "100": "completed", "101": "in_progress" }),
      }),
    ).resolves.toEqual({
      releasable: [
        { workNumber: 9, taskNumber: 42, generation: "g-1", runId: "100" },
      ],
      retained: [{ workNumber: 10, reason: "RUN_ACTIVE" }],
    });
  });

  it("never auto-releases human claims or claims whose run is unreadable", async () => {
    const items = [
      item(
        9,
        taskClaimFields({
          taskNumber: 42,
          claimant: "Stephen",
          generation: "human-g",
          runId: null,
          acquiredAt: "2026-08-29T18:00:00Z",
        }),
      ),
      item(
        10,
        taskClaimFields({
          taskNumber: 43,
          claimant: "agent:codex",
          generation: "agent-g",
          runId: "404",
          acquiredAt: "2026-08-29T18:00:00Z",
        }),
      ),
    ];

    await expect(
      planClaimReconciliation({
        repository: "Oxelio/Architecture-Web",
        repositoryToken: "token",
        items,
        fetchImpl: runFetch({}),
      }),
    ).resolves.toEqual({
      releasable: [],
      retained: [
        { workNumber: 9, reason: "HUMAN_CLAIM" },
        { workNumber: 10, reason: "RUN_UNAVAILABLE" },
      ],
    });
  });
});
