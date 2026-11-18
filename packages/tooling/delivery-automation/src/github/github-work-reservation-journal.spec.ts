import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
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
  return { journal, input, state, checkReservations, tags, refs };
}

type AuthoringInput = Parameters<
  ReturnType<typeof createGitHubWorkReservationJournal>["beginAuthoringWrite"]
>[0];

async function authoringInput(
  f: ReturnType<typeof fixture>,
  workNumber = 140,
): Promise<AuthoringInput> {
  const boundary = await f.journal().readAuthoringBoundary();
  const request = prepareAuthoringRequest({
    authenticatedSubject: "agent:fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber,
      clientKey: `28df4e21-8049-4f84-9ec3-${workNumber.toString(16).padStart(12, "0")}`,
      command: {
        kind: "edit-work",
        beforeStateDigest: "b".repeat(64),
        payloadDigest: "a".repeat(64),
      },
    },
  });
  if (!request) {
    throw new Error("Expected request");
  }
  const native = boundary.reservation;
  return {
    enabled: true,
    previous: boundary.position,
    workflowSha: "f".repeat(40),
    request,
    scope: {
      repositoryId: 1336937640,
      kind: "edit-work",
      affectedWorks: [workNumber],
      affectedPulls: [],
      affectedRefs: [],
    },
    authorityDigest: "e".repeat(64),
    inventoryComplete: true,
    maximumHistoryRevisions: 100,
    reserved: native
      ? {
          reservation: native.reservation,
          relevantWorks: [native.reservation.candidate.workNumber],
          relevantPulls: [native.reservation.candidate.pullNumber],
          relevantRefs: ["refs/heads/main", "refs/heads/codex/work-115"],
        }
      : null,
    readAuthority: async () => "e".repeat(64),
  };
}

function settlement(
  requestId: string,
  outcome: "confirmed" | "known-unstarted" | "not-applied" = "confirmed",
) {
  return {
    enabled: true,
    requestId,
    maximumHistoryRevisions: 100,
    authorizeRecovery: async () => true,
    observeOutcome: async () => ({ outcome, proofDigest: "d".repeat(64) }),
  };
}

function rewriteRevision(
  f: ReturnType<typeof fixture>,
  revision: number,
  change: (body: Record<string, unknown>) => Record<string, unknown>,
) {
  const ref = f.refs.get(`refs/tags/delivery-control/r${revision}`);
  const tag = ref
    ? (f.tags.get(ref.object.sha) as { message: string } | undefined)
    : undefined;
  if (!ref || !tag) {
    throw new Error("Expected fixture revision");
  }
  const payload = JSON.parse(tag.message) as { body: string };
  payload.body = JSON.stringify(
    change(JSON.parse(payload.body) as Record<string, unknown>),
  );
  f.tags.set(ref.object.sha, { ...tag, message: JSON.stringify(payload) });
}

describe("inactive durable authoring admission", () => {
  it("records proven non-application separately from success without permitting replay", async () => {
    const f = fixture();
    const input = await authoringInput(f);
    await f.journal().beginAuthoringWrite(input);
    expect(
      await f
        .journal()
        .finishAuthoringWrite(
          settlement(input.request.requestId, "not-applied"),
        ),
    ).toBe("settled");
    expect(
      (await f.journal().readAuthoringRequest(input.request.requestId, 100))
        ?.outcome,
    ).toBe("not-applied");
    expect(
      (await f.journal().beginAuthoringWrite(await authoringInput(f))).status,
    ).toBe("settled");
  });
  it("does no I/O until enabled", async () => {
    const f = fixture();
    const input = await authoringInput(f);
    const before = f.state.calls;
    expect(
      await f.journal().beginAuthoringWrite({ ...input, enabled: false }),
    ).toEqual({ status: "inactive" });
    expect(
      await f.journal().finishAuthoringWrite({
        ...settlement(input.request.requestId),
        enabled: false,
      }),
    ).toBe("inactive");
    expect(f.state.calls).toBe(before);
  });

  it("keeps replay identity after a terminal and never returns another admission", async () => {
    const f = fixture();
    const input = await authoringInput(f);
    expect((await f.journal().beginAuthoringWrite(input)).status).toBe(
      "admitted",
    );
    expect(
      (await f.journal().beginAuthoringWrite(await authoringInput(f))).status,
    ).toBe("pending");
    expect(
      await f
        .journal()
        .finishAuthoringWrite(settlement(input.request.requestId)),
    ).toBe("settled");
    expect(
      (await f.journal().beginAuthoringWrite(await authoringInput(f))).status,
    ).toBe("settled");
    expect(
      await f
        .journal()
        .finishAuthoringWrite(settlement(input.request.requestId)),
    ).toBe("already-settled");
    expect(f.refs.size).toBe(2);
    expect(f.state.projectWrites).toBe(0);
  });

  it("allows unrelated intents and completion while preserving affected quarantine", async () => {
    const f = fixture();
    const first = await authoringInput(f);
    await f.journal().beginAuthoringWrite(first);
    expect(
      (await f.journal().beginAuthoringWrite(await authoringInput(f, 999)))
        .status,
    ).toBe("admitted");
    expect((await f.journal().readAuthoringBoundary()).authoring).toHaveLength(
      2,
    );
    const fetchImpl = f.input.scope.publisher.fetchImpl;
    if (!fetchImpl) {
      throw new Error("Expected fixture transport");
    }
    const connection = { repositoryToken: controllerToken, fetchImpl };
    expect(await canRecordWorkCompletion(connection, 998)).toBe(true);
    expect(await canPublishManualWorkGate(connection, 998)).toBe(true);
    await expect(canRecordWorkCompletion(connection, 140)).rejects.toThrow(
      "AUTHORING_WRITE_PENDING",
    );
    await expect(canPublishManualWorkGate(connection)).rejects.toThrow(
      "AUTHORING_WRITE_PENDING",
    );
    expect(
      await f
        .journal()
        .finishAuthoringWrite(
          settlement(first.request.requestId, "known-unstarted"),
        ),
    ).toBe("settled");
    expect((await f.journal().readAuthoringBoundary()).authoring).toHaveLength(
      1,
    );
  });

  it("preserves strict native admission versions across independent global appends", async () => {
    const f = fixture();
    let injected = false;
    const result = await executeReservedGitHubWorkIntegration({
      ...f.input,
      authorize: async () => {
        const boundary = await f.journal().readAuthoringBoundary();
        if (
          !injected &&
          boundary.reservation?.reservation.state.phase === "pending"
        ) {
          injected = true;
          expect(
            (await f.journal().beginAuthoringWrite(await authoringInput(f)))
              .status,
          ).toBe("admitted");
        }
        return true;
      },
    });
    expect(injected).toBe(true);
    expect(result.status).toBe("confirmed");
    const boundary = await f.journal().readAuthoringBoundary();
    expect(boundary.position?.revision).toBe(4);
    expect(boundary.reservation?.revision).toBe(3);
    expect(boundary.reservation?.nativePosition.revision).toBe(4);
    expect(boundary.reservation?.reservation.state.phase).toBe("queued");
    expect(boundary.authoring).toHaveLength(1);
    expect(f.checkReservations).toHaveLength(1);
  });

  it("requires cancel-or-resolve for shared dependencies and never appends first", async () => {
    const f = fixture();
    await f.journal().reserve(candidate);
    const input = await authoringInput(f);
    if (!input.reserved) {
      throw new Error("Expected native context");
    }
    const count = f.refs.size;
    expect(
      (
        await f.journal().beginAuthoringWrite({
          ...input,
          reserved: { ...input.reserved, relevantWorks: [115, 140] },
        })
      ).status,
    ).toBe("cancel-or-resolve");
    expect(f.refs.size).toBe(count);
    expect(
      (
        await f
          .journal()
          .beginAuthoringWrite({ ...input, inventoryComplete: false })
      ).status,
    ).toBe("deferred");
  });

  it("does not promote a matching read-back after a lost creation response", async () => {
    const f = fixture();
    f.state.loseRef = "r1";
    const input = await authoringInput(f);
    expect((await f.journal().beginAuthoringWrite(input)).status).toBe(
      "deferred",
    );
    expect(
      (await f.journal().readAuthoringRequest(input.request.requestId, 100))
        ?.outcome,
    ).toBe("admitted");
    expect(
      (await f.journal().beginAuthoringWrite(await authoringInput(f))).status,
    ).toBe("pending");
    expect(f.refs.size).toBe(1);
  });

  it("leaves admission pending when authority is revoked and unknown results remain", async () => {
    const f = fixture();
    const input = await authoringInput(f);
    let checks = 0;
    expect(
      (
        await f.journal().beginAuthoringWrite({
          ...input,
          readAuthority: async () =>
            ++checks === 1 ? input.authorityDigest : null,
        })
      ).status,
    ).toBe("deferred");
    expect((await f.journal().readAuthoringBoundary()).authoring).toHaveLength(
      1,
    );
    expect(
      await f.journal().finishAuthoringWrite({
        ...settlement(input.request.requestId),
        observeOutcome: async () => null,
      }),
    ).toBe("deferred");
    expect((await f.journal().readAuthoringBoundary()).authoring).toHaveLength(
      1,
    );
    expect(f.refs.size).toBe(1);
  });

  it("gives only one caller a new admission when append attempts race", async () => {
    const f = fixture();
    const first = await authoringInput(f);
    const second = await authoringInput(f, 999);
    const results = await Promise.all([
      f.journal().beginAuthoringWrite(first),
      f.journal().beginAuthoringWrite(second),
    ]);
    expect(results.filter(({ status }) => status === "admitted")).toHaveLength(
      1,
    );
    expect((await f.journal().readAuthoringBoundary()).authoring).toHaveLength(
      1,
    );
    expect(f.refs.size).toBe(1);
  });

  it("rejects conflicting bytes and incomplete history instead of treating them as unseen", async () => {
    const f = fixture();
    const input = await authoringInput(f);
    await f.journal().beginAuthoringWrite(input);
    const changed = await authoringInput(f);
    const request = prepareAuthoringRequest({
      authenticatedSubject: "agent:fixture",
      envelope: {
        schema: 1,
        repositoryId: 1336937640,
        workNumber: 140,
        clientKey: "28df4e21-8049-4f84-9ec3-00000000008c",
        command: {
          kind: "edit-work",
          ...{
            beforeStateDigest: "b".repeat(64),
            payloadDigest: "c".repeat(64),
          },
        },
      },
    });
    if (!request) {
      throw new Error("Expected changed request");
    }
    expect(
      (await f.journal().beginAuthoringWrite({ ...changed, request })).status,
    ).toBe("conflict");
    expect(
      (
        await f.journal().beginAuthoringWrite({
          ...(await authoringInput(f, 999)),
          maximumHistoryRevisions: 0,
        })
      ).status,
    ).toBe("deferred");
    await f.journal().finishAuthoringWrite(settlement(input.request.requestId));
    await expect(
      f.journal().readAuthoringRequest(input.request.requestId, 1),
    ).rejects.toThrow("HISTORY_INCOMPLETE");
  });

  it("verifies the immutable native-version source after independent appends", async () => {
    const f = fixture();
    const initial = await f.journal().reserve(candidate);
    if (!initial) {
      throw new Error("Expected native reservation");
    }
    await f
      .journal()
      .append(initial, { candidate, state: { phase: "queued", checkId: 17 } });
    await f.journal().beginAuthoringWrite(await authoringInput(f));
    await f.journal().beginAuthoringWrite(await authoringInput(f, 999));
    rewriteRevision(f, 2, (body) => ({
      ...body,
      state: { phase: "armed", checkId: 17 },
    }));
    await expect(f.journal().read()).rejects.toThrow(
      "NATIVE_VERSION_SOURCE_UNVERIFIED",
    );
  });

  it("rejects dropping another pending intent from the copied snapshot", async () => {
    const f = fixture();
    await f.journal().beginAuthoringWrite(await authoringInput(f));
    await f.journal().beginAuthoringWrite(await authoringInput(f, 999));
    rewriteRevision(f, 2, (body) => ({
      ...body,
      authoring: (body["authoring"] as unknown[]).slice(1),
    }));
    await expect(f.journal().readAuthoringBoundary()).rejects.toThrow(
      "INTENT_DISCONTINUITY",
    );
  });

  it("rejects a legacy downgrade that could hide outstanding intents", async () => {
    const f = fixture();
    await f.journal().beginAuthoringWrite(await authoringInput(f));
    const boundary = await f.journal().readAuthoringBoundary();
    await appendMergeJournalRevision({
      repositoryToken: controllerToken,
      previous: boundary.position,
      candidateHeadSha: candidate.headSha,
      body: JSON.stringify({
        reservationId: "delivery-control/r2",
        candidate,
        state: { phase: "reserved" },
      }),
      ...(f.input.scope.publisher.fetchImpl
        ? { fetchImpl: f.input.scope.publisher.fetchImpl }
        : {}),
    });
    await expect(f.journal().reserve(candidate)).rejects.toThrow(
      "PROTOCOL_DOWNGRADE",
    );
  });
});

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
        await expect(check()).rejects.toThrow(
          kind === "authoring"
            ? "AUTHORING_JOURNAL_STATE_UNVERIFIED"
            : "MERGE_JOURNAL_KIND_UNVERIFIED",
        );
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
        previous: (await f.journal().readProjectStatusBoundary()).position,
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
