import { describe, expect, it } from "vitest";

import type { TaskClaimRecord } from "../control/task-claim.js";
import type { FetchLike } from "./github-project-inventory.js";
import {
  acquireTaskClaim,
  readPublishedTaskClaim,
  releaseTaskClaim,
  type TaskClaimTarget,
} from "./task-claim-publisher.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const target: TaskClaimTarget = {
  projectId: "PVT_1",
  projectItemId: "PVTI_9",
  fieldIds: {
    activeTask: "FIELD_ACTIVE_TASK",
    claimant: "FIELD_CLAIMANT",
    generation: "FIELD_GENERATION",
    run: "FIELD_RUN",
    acquiredAt: "FIELD_ACQUIRED_AT",
  },
};

const fieldNameById: Readonly<Record<string, string>> = {
  FIELD_ACTIVE_TASK: "activeTask",
  FIELD_CLAIMANT: "claimant",
  FIELD_GENERATION: "generation",
  FIELD_RUN: "run",
  FIELD_ACQUIRED_AT: "acquiredAt",
};

function createProjectApi(initial: Readonly<Record<string, string>> = {}): {
  readonly fetchImpl: FetchLike;
  readonly state: Record<string, string>;
  readonly mutationOrder: string[];
} {
  const state: Record<string, string> = { ...initial };
  const mutationOrder: string[] = [];

  const fetchImpl: FetchLike = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string>;
    };

    if (body.query.includes("ArchitectureWebTaskClaim")) {
      const value = (name: string) =>
        state[name] === undefined ? null : { text: state[name] };
      return jsonResponse({
        data: {
          node: {
            __typename: "ProjectV2Item",
            activeTask: value("activeTask"),
            claimant: value("claimant"),
            generation: value("generation"),
            run: value("run"),
            acquiredAt: value("acquiredAt"),
          },
        },
      });
    }

    const fieldId = body.variables["fieldId"];
    if (!fieldId) {
      throw new Error("Missing field id");
    }
    const fieldName = fieldNameById[fieldId];
    if (!fieldName) {
      throw new Error(`Unknown field id ${fieldId}`);
    }

    if (body.query.includes("ArchitectureWebSetTaskClaimField")) {
      mutationOrder.push(`set:${fieldName}`);
      state[fieldName] = body.variables["text"] ?? "";
      return jsonResponse({
        data: {
          updateProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_9" } },
        },
      });
    }

    if (body.query.includes("ArchitectureWebClearTaskClaimField")) {
      mutationOrder.push(`clear:${fieldName}`);
      Reflect.deleteProperty(state, fieldName);
      return jsonResponse({
        data: {
          clearProjectV2ItemFieldValue: { projectV2Item: { id: "PVTI_9" } },
        },
      });
    }

    throw new Error("Unexpected GraphQL operation");
  };

  return { fetchImpl, state, mutationOrder };
}

const automatedClaim: TaskClaimRecord = {
  taskNumber: 42,
  claimant: "agent:codex",
  generation: "generation-1",
  runId: "123456",
  acquiredAt: "2026-08-29T16:00:00Z",
};

describe("acquireTaskClaim", () => {
  it("writes Active Task last and verifies the complete generation", async () => {
    const api = createProjectApi();

    const result = await acquireTaskClaim({
      target,
      record: automatedClaim,
      projectsToken: "project-token",
      fetchImpl: api.fetchImpl,
    });

    expect(result).toEqual({ status: "acquired", record: automatedClaim });
    expect(api.mutationOrder).toEqual([
      "set:claimant",
      "set:generation",
      "set:run",
      "set:acquiredAt",
      "set:activeTask",
    ]);
    await expect(
      readPublishedTaskClaim({
        target,
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({ state: "active", record: automatedClaim });
  });

  it("refuses a pre-existing partial claim without mutating it", async () => {
    const api = createProjectApi({
      claimant: "agent:codex",
      generation: "partial-generation",
    });

    await expect(
      acquireTaskClaim({
        target,
        record: automatedClaim,
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({ status: "blocked", reason: "CLAIM_INCONSISTENT" });
    expect(api.mutationOrder).toEqual([]);
  });
});

describe("releaseTaskClaim", () => {
  it("refuses a stale generation without clearing a newer claim", async () => {
    const api = createProjectApi({
      activeTask: "42",
      claimant: "agent:codex",
      generation: "newer-generation",
      run: "123456",
      acquiredAt: "2026-08-29T16:00:00Z",
    });

    await expect(
      releaseTaskClaim({
        target,
        expectedTaskNumber: 42,
        expectedGeneration: "older-generation",
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "CLAIM_GENERATION_MISMATCH",
    });
    expect(api.mutationOrder).toEqual([]);
  });

  it("keeps generation until last and verifies an idle record", async () => {
    const api = createProjectApi({
      activeTask: "42",
      claimant: "agent:codex",
      generation: "generation-1",
      run: "123456",
      acquiredAt: "2026-08-29T16:00:00Z",
    });

    await expect(
      releaseTaskClaim({
        target,
        expectedTaskNumber: 42,
        expectedGeneration: "generation-1",
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({ status: "released" });

    expect(api.mutationOrder).toEqual([
      "clear:claimant",
      "clear:run",
      "clear:acquiredAt",
      "clear:activeTask",
      "clear:generation",
    ]);
    expect(api.state).toEqual({});
  });

  it("resumes a partially completed release when task and generation still match", async () => {
    const api = createProjectApi({
      activeTask: "42",
      generation: "generation-1",
    });

    await expect(
      releaseTaskClaim({
        target,
        expectedTaskNumber: 42,
        expectedGeneration: "generation-1",
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({ status: "released" });

    expect(api.mutationOrder).toEqual([
      "clear:activeTask",
      "clear:generation",
    ]);
    expect(api.state).toEqual({});
  });

  it("finishes a release interrupted after Active Task was cleared", async () => {
    const api = createProjectApi({ generation: "generation-1" });

    await expect(
      releaseTaskClaim({
        target,
        expectedTaskNumber: 42,
        expectedGeneration: "generation-1",
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({ status: "released" });

    expect(api.mutationOrder).toEqual(["clear:generation"]);
    expect(api.state).toEqual({});
  });

  it("refuses to resume an inconsistent release with a stale generation", async () => {
    const api = createProjectApi({
      activeTask: "42",
      generation: "newer-generation",
    });

    await expect(
      releaseTaskClaim({
        target,
        expectedTaskNumber: 42,
        expectedGeneration: "older-generation",
        projectsToken: "project-token",
        fetchImpl: api.fetchImpl,
      }),
    ).resolves.toEqual({
      status: "blocked",
      reason: "CLAIM_GENERATION_MISMATCH",
    });
    expect(api.mutationOrder).toEqual([]);
  });
});
