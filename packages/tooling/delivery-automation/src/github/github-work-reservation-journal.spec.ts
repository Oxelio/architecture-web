import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createGitHubWorkReservationJournal } from "./github-work-reservation-journal.js";
import {
  executeReservedGitHubInvalidation,
  executeReservedGitHubWorkIntegration,
  reconcileReservedGitHubInvalidation,
  reconcileReservedGitHubWorkIntegration,
} from "./reserved-work-integration.js";

const candidate = {
  workNumber: 115,
  pullNumber: 141,
  headSha: "a".repeat(40),
  baseSha: "b".repeat(40),
};
const controllerToken = "test-controller";
const issuerToken = "test-issuer";

function fixture() {
  const tags = new Map<string, object>();
  const refs = new Map<
    string,
    { ref: string; object: { type: "tag"; sha: string } }
  >();
  const checkReservations: string[] = [];
  const state = { loseRef: "", loseCheckResponse: false, calls: 0 };
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

    if (path.endsWith("/pulls/141")) {
      expect(auth).toBe("Bearer test-reader");
      return Response.json({
        number: candidate.pullNumber,
        state: "open",
        merged: false,
        head: { sha: candidate.headSha, repo: { id: 1336937640 } },
        base: { ref: "main", sha: candidate.baseSha, repo: { id: 1336937640 } },
        body: "Refs #115",
        auto_merge: null,
      });
    }
    expect(auth).toBe(`Bearer ${controllerToken}`);
    if (path.includes("/matching-refs/")) {
      return Response.json([...refs.values()]);
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
        object: { type: "tag" as const, sha: request.sha },
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
