import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canPublishManualWorkGate,
  canRecordWorkCompletion,
  createGitHubWorkReservationJournal,
} from "./github-work-reservation-journal.js";
import { appendMergeJournalRevision } from "./merge-reservation-journal.js";
import {
  executeReservedGitHubInvalidation,
  executeReservedGitHubWorkIntegration,
  reconcileReservedGitHubInvalidation,
  reconcileReservedGitHubWorkIntegration,
  recordReleasedNativeSquash,
} from "./reserved-work-integration.js";
import { runCoordinatedStatusWrite } from "./run-coordinated-status-write.js";
import { createCoordinatedProjectStatusWriter } from "./work-status-writer.js";

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const squashSha = "c".repeat(40);
const controllerToken = "test-controller";
const issuerToken = "test-issuer";
const projectsWriteToken = "test-project-writer";
const change = {
  projectId: "test-project",
  itemId: "test-item",
  fieldId: "test-status",
  from: { name: "Validating", optionId: "validating" },
  to: { name: "Reviewing", optionId: "reviewing" },
} as const;
const statusOptions = [
  { id: "validating", name: "Validating" },
  { id: "reviewing", name: "Reviewing" },
  { id: "implementing", name: "Implementing" },
];

function fixture() {
  const tags = new Map<string, object>();
  const refs = new Map<
    string,
    { ref: string; object: { type: "tag" | "commit"; sha: string } }
  >();
  const checkReservations: string[] = [];
  const state = {
    loseRef: "",
    loseCheckResponse: false,
    calls: 0,
    status: "validating",
    statusUpdatedAt: "2026-11-17T08:48:00Z",
    projectWrites: 0,
    loseProjectResponse: false,
    merged: false,
    squashParent: candidate.baseSha,
    dependencies: [] as number[],
  };
  const publishedChecks: object[] = [];
  const fetchImpl = async (request: RequestInfo | URL, init?: RequestInit) => {
    state.calls++;
    const path = new URL(String(request)).pathname;
    const auth = new Headers(init?.headers).get("authorization");
    if (path.endsWith("/check-runs")) {
      expect(auth).toBe(`Bearer ${issuerToken}`);
      if (init?.method !== "POST") {
        expect(init?.method).toBeUndefined();
        return Response.json({
          total_count: publishedChecks.length,
          check_runs: publishedChecks,
        });
      }
      const check = JSON.parse(String(init.body)) as { external_id: string };
      checkReservations.push(check.external_id);
      const result = {
        ...check,
        id: 17,
        app: { id: 7 },
        conclusion: null,
        html_url: "https://github.com/Oxelio/architecture-web/runs/17",
      };
      publishedChecks.push(result);
      if (state.loseCheckResponse) {
        throw new Error("simulated lost check response");
      }
      return Response.json(result, { status: 201 });
    }

    if (path === "/graphql") {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: object;
      };
      if (body.query.includes("query ArchitectureWebWorkStatus")) {
        expect(auth).toBe("Bearer test-project-reader");
        expect(body.variables).toEqual({ number: candidate.workNumber });
        const selected = statusOptions.find(({ id }) => id === state.status);
        return Response.json({
          data: {
            user: {
              databaseId: 83680141,
              projectV2: {
                id: change.projectId,
                closed: false,
                field: { id: change.fieldId, options: statusOptions },
              },
            },
            repository: {
              databaseId: 1336937640,
              issue: {
                number: candidate.workNumber,
                parent: null,
                projectItems: {
                  nodes: [
                    {
                      id: change.itemId,
                      project: { id: change.projectId },
                      status: {
                        name: selected?.name,
                        optionId: selected?.id,
                        updatedAt: state.statusUpdatedAt,
                        field: { id: change.fieldId },
                      },
                    },
                  ],
                  pageInfo: { hasNextPage: false },
                },
              },
            },
          },
        });
      }
      expect(body.query).toContain("mutation ArchitectureWebChangeWorkStatus");
      expect(auth).toBe(`Bearer ${projectsWriteToken}`);
      expect(body.variables).toEqual({
        project: change.projectId,
        item: change.itemId,
        field: change.fieldId,
        option: change.to.optionId,
      });
      state.projectWrites++;
      state.status = change.to.optionId;
      if (state.loseProjectResponse) {
        throw new Error("simulated loss of Project write acknowledgement");
      }
      return Response.json({
        data: {
          updateProjectV2ItemFieldValue: {
            projectV2Item: { id: change.itemId },
          },
        },
      });
    }

    if (path.endsWith(`/commits/${squashSha}`)) {
      expect(auth).toBe("Bearer test-reader");
      return Response.json({
        sha: squashSha,
        parents: [{ sha: state.squashParent }],
      });
    }
    if (path.endsWith(`/compare/${squashSha}...main`)) {
      expect(auth).toBe("Bearer test-reader");
      return Response.json({
        status: "ahead",
        merge_base_commit: { sha: squashSha },
      });
    }
    if (path.endsWith("/issues/115/dependencies/blocked_by")) {
      expect(auth).toBe("Bearer test-reader");
      return Response.json(
        state.dependencies.map((number) => ({
          number,
          repository_url:
            "https://api.github.com/repos/Oxelio/architecture-web",
        })),
      );
    }
    if (path.endsWith("/pulls/141")) {
      expect(auth).toBe("Bearer test-reader");
      return Response.json({
        number: candidate.pullNumber,
        state: state.merged ? "closed" : "open",
        merged: state.merged,
        merge_commit_sha: state.merged ? squashSha : null,
        head: { sha: candidate.headSha, repo: { id: 1336937640 } },
        base: { ref: "main", sha: candidate.baseSha, repo: { id: 1336937640 } },
        body: "Refs #115",
        auto_merge: null,
      });
    }
    if (init?.method === "POST" || auth !== "Bearer test-reader") {
      expect(auth).toBe(`Bearer ${controllerToken}`);
    }
    if (path.includes("/matching-refs/")) {
      return Response.json(
        [...refs.values()].filter(({ ref }) =>
          ref.startsWith("refs/tags/delivery-control/r"),
        ),
      );
    }
    if (path.includes("/ref/tags/")) {
      const name = path.slice(path.indexOf("/ref/") + "/ref/".length);
      const found = refs.get(`refs/${name}`);
      return found ? Response.json(found) : new Response(null, { status: 404 });
    }
    if (init?.method === "POST" && path.endsWith("/git/tags")) {
      const tag = JSON.parse(String(init.body)) as { object: string };
      const sha = createHash("sha1").update(String(init.body)).digest("hex");
      const payload = {
        ...tag,
        object: { type: "commit", sha: tag.object },
        sha,
      };
      tags.set(sha, payload);
      return Response.json(payload, { status: 201 });
    }
    if (path.includes("/git/tags/")) {
      const tag = tags.get(path.split("/").at(-1) ?? "");
      return tag ? Response.json(tag) : new Response(null, { status: 404 });
    }
    if (init?.method === "POST" && path.endsWith("/git/refs")) {
      const request = JSON.parse(String(init.body)) as {
        ref: string;
        sha: string;
      };
      if (refs.has(request.ref)) {
        return new Response(null, { status: 422 });
      }
      const ref = {
        ref: request.ref,
        object: {
          type: request.ref.includes("/status-")
            ? ("commit" as const)
            : ("tag" as const),
          sha: request.sha,
        },
      };
      refs.set(request.ref, ref);
      if (request.ref.endsWith(state.loseRef) && state.loseRef) {
        throw new Error("simulated lost response");
      }
      return Response.json(ref, { status: 201 });
    }
    throw new Error(`Unexpected request ${path}`);
  };

  const journal = () =>
    createGitHubWorkReservationJournal({
      repositoryToken: controllerToken,
      fetchImpl,
    });
  const input: Parameters<typeof executeReservedGitHubWorkIntegration>[0] = {
    candidate,
    operation: "queue-check",
    standingEnabled: true,
    authorize: async () => true,
    scope: {
      checksAppId: 7,
      checksToken: issuerToken,
      controllerBotId: 9,
      cancellationRulesetId: 9,
      publisher: {
        repository: "Oxelio/architecture-web",
        repositoryId: 1336937640,
        actorId: 9,
        projectId: "test-project",
        projectsToken: "test-project-reader",
        repositoryToken: "test-reader",
        mergeToken: controllerToken,
        fetchImpl,
        activation: {
          workState: true,
          dependencies: true,
          workIntegrationPr: true,
          priority: false,
          routes: false,
          taskParent: true,
          taskClaim: false,
        },
        readGrant: async () => null,
        withinVerifiedBoundary: async (_candidate, _mode, action) => action(),
      },
    },
  };
  return { journal, input, state, checkReservations };
}

describe("protected manual check publisher", () => {
  it.each(["authoring", "unknown", null, 1])(
    "rejects unsupported journal kind %s even with legacy-looking reservation fields",
    async (kind) => {
      const { input, journal, state } = fixture();
      const fetchImpl = input.scope.publisher.fetchImpl;
      if (!fetchImpl) {
        throw new Error("Expected fixture transport");
      }
      await appendMergeJournalRevision({
        repositoryToken: controllerToken,
        previous: null,
        candidateHeadSha: candidate.headSha,
        body: JSON.stringify({
          kind,
          reservationId: "delivery-control/r1",
          candidate,
          state: { phase: "reserved" },
          pending: { requestId: "a".repeat(64) },
        }),
        fetchImpl,
      });
      const connection = { repositoryToken: "test-reader", fetchImpl };
      const pending = {
        commentId: 1,
        workNumber: 140,
        authorityId: 2,
        commandDigest: "a".repeat(64),
      };
      const position = { revision: 1, tagSha: "b".repeat(40) };
      const checks = [
        () => journal().read(),
        () => journal().readProjectStatusBoundary(),
        () => journal().reserve(candidate),
        () =>
          journal().beginProjectStatusWrite({
            previous: position,
            workflowSha: candidate.headSha,
            intent: pending,
          }),
        () => journal().finishProjectStatusWrite(position, pending),
        () => canPublishManualWorkGate(connection),
        () => canRecordWorkCompletion(connection, 140),
      ];
      for (const check of checks) {
        await expect(check()).rejects.toThrow("MERGE_JOURNAL_KIND_UNVERIFIED");
      }
      expect(state.projectWrites).toBe(0);
    },
  );

  it("admits the ordinary publisher on an empty journal", async () => {
    const { input } = fixture();
    const { repositoryToken, fetchImpl } = input.scope.publisher;
    await expect(
      canPublishManualWorkGate({
        repositoryToken,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    ).resolves.toBe(true);
  });

  it.each(["armed", "released"] as const)(
    "keeps the manual check out while the native request is %s",
    async (phase) => {
      const { input, journal, state } = fixture();
      const persisted = journal();
      const initial = await persisted.reserve(candidate);
      if (!initial) {
        throw new Error("Expected reservation");
      }
      const active = await persisted.append(initial, {
        candidate,
        state: { phase, checkId: 17 },
      });
      if (!active) {
        throw new Error("Expected native request");
      }
      const { repositoryToken, fetchImpl } = input.scope.publisher;
      const connection = {
        repositoryToken,
        ...(fetchImpl ? { fetchImpl } : {}),
      };
      await expect(canPublishManualWorkGate(connection)).resolves.toBe(false);
      state.merged = true;
      state.squashParent = "d".repeat(40);
      await expect(canPublishManualWorkGate(connection)).resolves.toBe(false);
      state.squashParent = candidate.baseSha;
      await expect(canPublishManualWorkGate(connection)).resolves.toBe(true);
      await persisted.append(active, {
        candidate,
        state: { phase: "merged", sha: squashSha },
      });
      await expect(canPublishManualWorkGate(connection)).resolves.toBe(true);
    },
  );

  it("refuses manual publication if the live journal cannot be verified", async () => {
    await expect(
      canPublishManualWorkGate({
        repositoryToken: "test-reader",
        fetchImpl: async () => new Response(null, { status: 503 }),
      }),
    ).rejects.toThrow("MERGE_JOURNAL_INVENTORY_UNAVAILABLE");
  });
});

describe("persistent GitHub Work integration reservation", () => {
  it("uses the original persisted revision as check identity after a restart", async () => {
    const f = fixture();
    const original = await f.journal().reserve(candidate);
    expect(original?.reservationId).toBe("delivery-control/r1");

    const queued = await executeReservedGitHubWorkIntegration(f.input);
    expect(queued).toMatchObject({ status: "confirmed" });
    expect(f.checkReservations).toEqual([original?.reservationId]);
    const restarted = await f.journal().read();
    expect(restarted).toMatchObject({
      revision: 3,
      reservationId: original?.reservationId,
      reservation: { candidate, state: { phase: "queued", checkId: 17 } },
    });
    expect(
      await f.journal().reserve({ ...candidate, workNumber: 139 }),
    ).toBeNull();
    expect(await executeReservedGitHubWorkIntegration(f.input)).toEqual({
      status: "deferred",
    });
    expect(f.checkReservations).toHaveLength(1);
  });

  it("leaves a lost intent pending without publishing or replaying its check", async () => {
    const f = fixture();
    f.state.loseRef = "/r2";
    expect(await executeReservedGitHubWorkIntegration(f.input)).toEqual({
      status: "deferred",
    });
    expect(await f.journal().read()).toMatchObject({
      revision: 2,
      reservation: { state: { phase: "pending", operation: "queue-check" } },
    });
    expect(await executeReservedGitHubWorkIntegration(f.input)).toEqual({
      status: "deferred",
    });
    expect(f.checkReservations).toEqual([]);
  });

  it("does not reserve a candidate or create a check if writer exclusion is unavailable", async () => {
    const f = fixture();
    const { scope } = f.input;
    const result = await executeReservedGitHubWorkIntegration({
      ...f.input,
      scope: {
        ...scope,
        publisher: {
          ...scope.publisher,
          withinVerifiedBoundary: async () => null,
        },
      },
    });
    expect(result).toEqual({ status: "deferred" });
    expect(f.checkReservations).toEqual([]);
    expect(f.state.calls).toBe(0);
    expect(await f.journal().read()).toBeNull();
  });

  it("does not reserve when delegation is withdrawn while verifying the writer boundary", async () => {
    const f = fixture();
    const { scope } = f.input;
    let delegated = true;
    const result = await executeReservedGitHubWorkIntegration({
      ...f.input,
      authorize: async () => delegated,
      scope: {
        ...scope,
        publisher: {
          ...scope.publisher,
          withinVerifiedBoundary: async (_candidate, _mode, action) => {
            delegated = false;
            return action();
          },
        },
      },
    });
    expect(result).toEqual({ status: "deferred" });
    expect(f.state.calls).toBe(0);
  });

  it("has no GitHub effects when disabled or unauthorized", async () => {
    const f = fixture();
    expect(
      await executeReservedGitHubWorkIntegration({
        ...f.input,
        standingEnabled: false,
      }),
    ).toEqual({ status: "inactive" });
    expect(
      await executeReservedGitHubWorkIntegration({
        ...f.input,
        authorize: async () => false,
      }),
    ).toEqual({ status: "denied" });
    expect(f.state.calls).toBe(0);
  });

  it("recovers an accepted queued check after a response loss without creating another check", async () => {
    const f = fixture();
    f.state.loseCheckResponse = true;
    expect(await executeReservedGitHubWorkIntegration(f.input)).toEqual({
      status: "deferred",
    });
    expect(await reconcileReservedGitHubWorkIntegration(f.input)).toMatchObject(
      {
        status: "confirmed",
        receipt: { reservation: { state: { phase: "queued", checkId: 17 } } },
      },
    );
    expect(await executeReservedGitHubWorkIntegration(f.input)).toEqual({
      status: "deferred",
    });
    expect(f.checkReservations).toHaveLength(1);
  });
});

describe("persistent invalidating write", () => {
  const writeId = "e".repeat(64);

  it("durably resolves the old reservation before applying an authorized write", async () => {
    const f = fixture();
    await f.journal().reserve(candidate);
    let writes = 0;
    const result = await executeReservedGitHubInvalidation({
      ...f.input,
      writeId,
      apply: async () => {
        writes++;
        expect(await f.journal().read()).toMatchObject({
          revision: 4,
          reservation: { state: { phase: "invalidating", writeId } },
        });
        return true;
      },
    });
    expect(result).toMatchObject({
      status: "confirmed",
      receipt: { reservation: { state: { phase: "invalidated", writeId } } },
    });
    expect(writes).toBe(1);
  });

  it("keeps an uncertain write pending and only reconciles the same command", async () => {
    const f = fixture();
    await f.journal().reserve(candidate);
    let writes = 0;
    const request = {
      ...f.input,
      writeId,
      apply: async () => {
        writes++;
        throw new Error("simulated response loss");
      },
    };
    expect(await executeReservedGitHubInvalidation(request)).toEqual({
      status: "deferred",
    });
    expect(await executeReservedGitHubInvalidation(request)).toEqual({
      status: "deferred",
    });
    expect(
      await reconcileReservedGitHubInvalidation({
        ...f.input,
        writeId: "f".repeat(64),
        observeApplied: async () => true,
      }),
    ).toEqual({ status: "deferred" });
    expect(
      await reconcileReservedGitHubInvalidation({
        ...f.input,
        writeId,
        observeApplied: async () => true,
      }),
    ).toMatchObject({ status: "confirmed" });
    expect(writes).toBe(1);
  });

  it("cannot apply a write if resolution authority is missing", async () => {
    const f = fixture();
    await f.journal().reserve(candidate);
    let writes = 0;
    expect(
      await executeReservedGitHubInvalidation({
        ...f.input,
        writeId,
        authorize: async ({ operation }) => operation === "invalidate",
        apply: async () => {
          writes++;
          return true;
        },
      }),
    ).toEqual({ status: "denied" });
    expect(writes).toBe(0);
  });
});

describe("canonical Project #3 Status writer", () => {
  function setup() {
    const f = fixture();
    const { fetchImpl } = f.input.scope.publisher;
    const config = {
      projectId: change.projectId,
      repositoryToken: "repository-reader",
      controllerToken,
      projectsReadToken: "test-project-reader",
      projectsWriteToken,
      ...(fetchImpl ? { fetchImpl } : {}),
    };
    const request = {
      kind: "record-work-status",
      repositoryId: 1336937640,
      projectNumber: 3,
      workNumber: candidate.workNumber,
      from: change.from.name,
      to: change.to.name,
      statusUpdatedAt: "2026-11-17T08:48:00Z",
      evidenceCommentIds: [202],
    } as const;
    const writer = createCoordinatedProjectStatusWriter(config);
    if (!writer) {
      throw new Error("Expected isolated Project writer");
    }
    return { f, config, request, writer };
  }

  it("reads with the observation credential and publishes with the distinct Project writer", async () => {
    const { f, writer, request } = setup();
    const current = await writer.readStatus(request);
    if (!current) {
      throw new Error("Expected canonical Project status");
    }
    expect(current.name).toBe("Validating");
    expect(
      await writer.writeStatus(request, current.binding, async () => true),
    ).toBe("confirmed");
    expect((await writer.readStatus(request))?.name).toBe("Reviewing");
    expect(f.state.projectWrites).toBe(1);
  });

  it("refuses stale Status, unresolved mapping and shared credentials", async () => {
    const { f, config, request, writer } = setup();
    const current = await writer.readStatus(request);
    if (!current) {
      throw new Error("Expected canonical Project status");
    }
    expect(
      await writer.writeStatus(
        request,
        { ...current.binding, fieldId: "other-status" },
        async () => true,
      ),
    ).toBe("unstarted");
    expect(
      await writer.writeStatus(request, current.binding, async () => false),
    ).toBe("unstarted");
    f.state.status = "implementing";
    expect(
      await writer.writeStatus(request, current.binding, async () => true),
    ).toBe("unstarted");
    const wrongProject = createCoordinatedProjectStatusWriter({
      ...config,
      projectId: "other-project",
    });
    expect(
      await wrongProject?.writeStatus(
        request,
        current.binding,
        async () => true,
      ),
    ).toBe("unstarted");
    expect(
      createCoordinatedProjectStatusWriter({
        ...config,
        projectsWriteToken: controllerToken,
      }),
    ).toBeNull();
    expect(f.state.projectWrites).toBe(0);
  });
});

describe("observed native squash", () => {
  it("only releases the durable reservation for an exact verified native squash", async () => {
    const f = fixture();
    const journal = f.journal();
    const initial = await journal.reserve(candidate);
    if (!initial) {
      throw new Error("fixture reservation was not created");
    }
    await journal.append(initial, {
      candidate,
      state: { phase: "released", checkId: 17 },
    });
    expect(await recordReleasedNativeSquash(f.input)).toBeNull();
    f.state.merged = true;
    f.state.squashParent = candidate.headSha;
    expect(await recordReleasedNativeSquash(f.input)).toBeNull();
    expect(await journal.reserve({ ...candidate, workNumber: 139 })).toBeNull();
    f.state.squashParent = candidate.baseSha;
    expect(await recordReleasedNativeSquash(f.input)).toBe(squashSha);
    expect((await journal.read())?.reservation.state).toEqual({
      phase: "merged",
      sha: squashSha,
    });
    expect(
      await journal.reserve({ ...candidate, workNumber: 139 }),
    ).not.toBeNull();
    expect(f.checkReservations).toEqual([]);
  });
});

describe("Work Completion in the protected group", () => {
  it("defers a conflicting completion while leaving unrelated Work available", async () => {
    const f = fixture();
    const journal = f.journal();
    const initial = await journal.reserve(candidate);
    if (!initial) {
      throw new Error("Expected reservation");
    }
    await journal.append(initial, {
      candidate,
      state: { phase: "released", checkId: 17 },
    });
    f.state.dependencies = [139];
    const { repositoryToken, fetchImpl } = f.input.scope.publisher;
    const reader = { repositoryToken, ...(fetchImpl ? { fetchImpl } : {}) };
    await expect(
      canRecordWorkCompletion(reader, candidate.workNumber),
    ).resolves.toBe(false);
    await expect(canRecordWorkCompletion(reader, 139)).resolves.toBe(false);
    await expect(canRecordWorkCompletion(reader, 140)).resolves.toBe(true);
    f.state.merged = true;
    await expect(
      canRecordWorkCompletion(reader, candidate.workNumber),
    ).resolves.toBe(true);
  });
});

describe("Project Status intent in the shared controller journal", () => {
  const intent = {
    commentId: 83,
    workNumber: 140,
    authorityId: 91,
    commandDigest: "d".repeat(64),
  };

  it("blocks new reservations and the other protected writers while the outcome is unknown", async () => {
    const f = fixture();
    const store = f.journal();
    const position = await store.beginProjectStatusWrite({
      previous: null,
      workflowSha: candidate.baseSha,
      intent,
    });
    expect(position?.revision).toBe(1);
    expect(await f.journal().readProjectStatusBoundary()).toMatchObject({
      position,
      reservation: null,
      pending: intent,
    });
    await expect(f.journal().read()).rejects.toThrow(
      "PROJECT_STATUS_WRITE_PENDING",
    );
    expect(await store.reserve(candidate)).toBeNull();

    const { repositoryToken, fetchImpl } = f.input.scope.publisher;
    const reader = { repositoryToken, ...(fetchImpl ? { fetchImpl } : {}) };
    expect(await canPublishManualWorkGate(reader)).toBe(false);
    expect(await canRecordWorkCompletion(reader, 140)).toBe(false);

    if (!position) {
      throw new Error("Expected intent position");
    }
    expect(
      await store.finishProjectStatusWrite(position, {
        ...intent,
        workNumber: 138,
      }),
    ).toBe(false);
    expect(await f.journal().finishProjectStatusWrite(position, intent)).toBe(
      true,
    );
    expect(await f.journal().read()).toBeNull();
    expect(await canPublishManualWorkGate(reader)).toBe(true);
    expect((await f.journal().reserve(candidate))?.revision).toBe(3);
  });

  it.each(["reserved", "released"] as const)(
    "preserves an unrelated %s merge reservation across a completed Status write",
    async (phase) => {
      const f = fixture();
      const store = f.journal();
      const reservation = await store.reserve(candidate);
      if (!reservation) {
        throw new Error("Expected reservation");
      }
      const active =
        phase === "reserved"
          ? reservation
          : await store.append(reservation, {
              candidate,
              state: { phase, checkId: 17 },
            });
      if (!active) {
        throw new Error("Expected active reservation");
      }

      expect(
        await store.beginProjectStatusWrite({
          previous: null,
          workflowSha: candidate.baseSha,
          intent,
        }),
      ).toBeNull();
      const position = await store.beginProjectStatusWrite({
        previous: { revision: active.revision, tagSha: active.tagSha },
        workflowSha: candidate.baseSha,
        intent,
      });
      if (!position) {
        throw new Error("Expected intent position");
      }
      expect(
        (await f.journal().readProjectStatusBoundary()).reservation
          ?.reservation,
      ).toEqual(active.reservation);
      expect(await f.journal().finishProjectStatusWrite(position, intent)).toBe(
        true,
      );
      expect(await f.journal().read()).toMatchObject({
        reservationId: active.reservationId,
        reservation: active.reservation,
        revision: position.revision + 1,
      });
    },
  );

  it("quarantines a persisted intent even if its first append acknowledgement was lost", async () => {
    const f = fixture();
    f.state.loseRef = "/r1";
    expect(
      await f.journal().beginProjectStatusWrite({
        previous: null,
        workflowSha: candidate.baseSha,
        intent,
      }),
    ).toBeNull();
    expect((await f.journal().readProjectStatusBoundary()).pending).toEqual(
      intent,
    );
    expect(await f.journal().reserve(candidate)).toBeNull();
  });
});

describe("Coordinated Project Status execution", () => {
  function commandFixture() {
    const f = fixture();
    const authorization = {
      authorityId: 91,
      command: {
        kind: "record-work-status",
        repositoryId: 1336937640,
        projectNumber: 3,
        workNumber: 140,
        from: "Validating",
        to: "Reviewing",
        statusUpdatedAt: "2026-11-17T08:48:00Z",
        evidenceCommentIds: [134],
      },
    } as const;
    const state = {
      status: "Validating",
      statusUpdatedAt: "2026-11-17T08:48:00Z",
      allowed: true,
      verified: true,
      loseResponse: false,
      writes: 0,
      reservationAllowed: false,
    };
    const { fetchImpl } = f.input.scope.publisher;
    const input: Parameters<typeof runCoordinatedStatusWrite>[0] = {
      enabled: true,
      commentId: 83,
      workflowSha: candidate.baseSha,
      controllerToken,
      ...(fetchImpl ? { fetchImpl } : {}),
      readAuthorization: async () => (state.allowed ? authorization : null),
      readRecoveryAuthorization: async (id) =>
        id === authorization.authorityId ? authorization : null,
      verifyBoundary: async () => state.verified,
      mayWriteWithReservation: async () => state.reservationAllowed,
      readStatus: async () => ({
        name: state.status,
        updatedAt: state.statusUpdatedAt,
        binding: {
          projectId: change.projectId,
          itemId: change.itemId,
          fieldId: change.fieldId,
          fromOptionId: change.from.optionId,
          toOptionId: change.to.optionId,
        },
      }),
      writeStatus: async (command) => {
        state.writes++;
        state.status = command.to;
        state.statusUpdatedAt = "2026-11-17T08:50:00Z";
        return state.loseResponse ? "unverified" : "confirmed";
      },
    };
    return { f, input, state };
  }

  it("records a verified transition and refuses replay after Status returns to its original value", async () => {
    const { f, input, state } = commandFixture();
    expect(await runCoordinatedStatusWrite(input)).toBe("recorded");
    state.status = "Validating";
    expect(await runCoordinatedStatusWrite(input)).toBe("already-admitted");
    expect(state.writes).toBe(1);
    expect((await f.journal().readProjectStatusBoundary()).pending).toBeNull();
  });

  it("refuses an old approval submitted in a different command after returning to the same Status", async () => {
    const { f, input, state } = commandFixture();
    expect(await runCoordinatedStatusWrite(input)).toBe("recorded");
    state.status = "Validating";
    state.statusUpdatedAt = "2026-11-17T08:51:00Z";
    expect(await runCoordinatedStatusWrite({ ...input, commentId: 84 })).toBe(
      "deferred",
    );
    expect(state.writes).toBe(1);
    expect((await f.journal().readProjectStatusBoundary()).pending).toBeNull();
  });

  it("reconciles a lost Project acknowledgement after ordinary authority has been revoked", async () => {
    const { f, input, state } = commandFixture();
    state.loseResponse = true;
    expect(await runCoordinatedStatusWrite(input)).toBe("deferred");
    expect(
      (await f.journal().readProjectStatusBoundary()).pending?.commentId,
    ).toBe(83);
    expect(await runCoordinatedStatusWrite({ ...input, commentId: 84 })).toBe(
      "deferred",
    );
    state.allowed = false;
    expect(await runCoordinatedStatusWrite(input)).toBe("reconciled");
    expect(state.writes).toBe(1);
  });

  it("does not mutate when inactive, the boundary is false, or the existing reservation conflicts", async () => {
    const { f, input, state } = commandFixture();
    expect(await runCoordinatedStatusWrite({ ...input, enabled: false })).toBe(
      "inactive",
    );
    state.verified = false;
    expect(await runCoordinatedStatusWrite(input)).toBe("denied");
    state.verified = true;
    await f.journal().reserve(candidate);
    expect(await runCoordinatedStatusWrite(input)).toBe("deferred");
    expect(state.writes).toBe(0);
    state.reservationAllowed = true;
    expect(await runCoordinatedStatusWrite(input)).toBe("recorded");
    expect(state.writes).toBe(1);
  });

  it("does not start a write after the exact command receipt acknowledgement was lost", async () => {
    const { f, input, state } = commandFixture();
    f.state.loseRef = "/status-83";
    expect(await runCoordinatedStatusWrite(input)).toBe("deferred");
    expect(await runCoordinatedStatusWrite(input)).toBe("already-admitted");
    expect(state.writes).toBe(0);
  });
});
