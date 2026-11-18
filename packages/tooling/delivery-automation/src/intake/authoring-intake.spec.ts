import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import { createAuthoringDispatcher } from "./authoring-dispatch.js";
import { createAuthoringIntake } from "./authoring-intake.js";
import { createGitHubJobAuthenticator } from "./github-job-authentication.js";
import {
  payloadDigest,
  SealedAuthoringStore,
} from "./sealed-authoring-store.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "authoring-intake-"));
  directories.push(directory);
  let now = Date.now();
  const store = new SealedAuthoringStore({
    directory,
    maximumPayloadBytes: 1000,
    maximumLifetimeMs: 1000,
    now: () => now,
  });
  const bytes = Buffer.from(JSON.stringify({ body: "synthetic fixture" }));
  const envelope = {
    schema: 1,
    repositoryId: 1336937640,
    workNumber: 140,
    clientKey: "11111111-1111-4111-8111-111111111111",
    command: {
      kind: "edit-work",
      beforeStateDigest: "a".repeat(64),
      payloadDigest: payloadDigest(bytes),
    },
  };
  const request = prepareAuthoringRequest({
    authenticatedSubject: "fixture-agent",
    envelope,
  });
  if (!request) {
    throw new Error("Invalid fixture request");
  }
  const job = {
    runId: "123",
    runAttempt: "1" as const,
    workflowSha: "a".repeat(40),
  };
  return {
    directory,
    store,
    bytes,
    envelope,
    request,
    job,
    advance: () => {
      now += 1001;
    },
  };
}

describe("sealed authoring transport", () => {
  it("preserves one immutable payload and rejects conflicting retries", async () => {
    const f = await fixture();
    expect(await f.store.seal(f.request, f.bytes)).toBe("sealed");
    expect(await f.store.seal(f.request, f.bytes)).toBe("duplicate");
    expect(
      await f.store.seal(
        { ...f.request, commandDigest: "b".repeat(64) },
        f.bytes,
      ),
    ).toBe("conflict");
    expect(await f.store.seal(f.request, Buffer.from("changed"))).toBe(
      "rejected",
    );
    expect(await f.store.seal(f.request, Buffer.alloc(1001))).toBe("rejected");
    expect(await readdir(f.directory)).toHaveLength(2);
  });

  it("claims dispatch once under concurrent callers and binds one job", async () => {
    const f = await fixture();
    await f.store.seal(f.request, f.bytes);
    expect(
      await Promise.all([
        f.store.claimDispatch(f.request.requestId),
        f.store.claimDispatch(f.request.requestId),
      ]),
    ).toEqual(expect.arrayContaining([true, false]));
    expect(
      await f.store.fetchPayload(
        f.request.requestId,
        payloadDigest(f.bytes),
        f.job,
      ),
    ).toMatchObject({ payload: f.bytes });
    expect(
      await f.store.fetchPayload(f.request.requestId, payloadDigest(f.bytes), {
        ...f.job,
        runId: "124",
      }),
    ).toBeNull();
    const result = {
      status: "confirmed" as const,
      canonicalUrls: ["https://github.com/Oxelio/architecture-web/issues/140"],
    };
    expect(
      await f.store.recordResult(
        f.request.requestId,
        { ...f.job, runId: "124" },
        result,
      ),
    ).toBe(false);
    expect(await f.store.recordResult(f.request.requestId, f.job, result)).toBe(
      true,
    );
    expect(
      await f.store.recordResult(f.request.requestId, f.job, {
        ...result,
        status: "denied",
      }),
    ).toBe(false);
    expect(await f.store.result(f.request.requestId)).toEqual(result);
  });

  it("disposes expired bytes without forgetting the request or proving quiescence", async () => {
    const f = await fixture();
    await f.store.seal(f.request, f.bytes);
    await f.store.claimDispatch(f.request.requestId);
    f.advance();
    await f.store.expirePayload(f.request.requestId);
    expect(
      await f.store.fetchPayload(
        f.request.requestId,
        payloadDigest(f.bytes),
        f.job,
      ),
    ).toBeNull();
    expect(await f.store.seal(f.request, f.bytes)).toBe("expired");
    expect(await f.store.claimDispatch(f.request.requestId)).toBe(false);
    expect(await f.store.header(f.request.requestId)).not.toBeNull();
    expect(await f.store.result(f.request.requestId)).toBeNull();
    await expect(
      readFile(
        join(f.directory, `${f.request.requestId}.${payloadDigest(f.bytes)}`),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("sweeps expired staging bytes without removing transport receipts", async () => {
    const f = await fixture();
    await f.store.seal(f.request, f.bytes);
    f.advance();
    await f.store.expirePayloads();
    expect(await readdir(f.directory)).toEqual([
      `${f.request.requestId}.header`,
    ]);
  });
});

describe("inactive private MCP intake", () => {
  async function setup(enabled = true) {
    const f = await fixture();
    const access = "synthetic-caller-".repeat(4);
    const dispatch = vi.fn().mockResolvedValue("dispatched");
    const intake = createAuthoringIntake({
      enabled,
      publicOrigin: "https://intake.invalid",
      maximumRequestBytes: 4096,
      callers: [
        {
          subject: "fixture-agent",
          tokenDigest: createHash("sha256").update(access).digest("hex"),
        },
      ],
      store: f.store,
      dispatch,
      authenticateJob: async () => null,
      readProjectContext: async () => ({
        projectNumber: 3,
        capturedAt: "fixture",
        items: [],
      }),
    });
    const call = (name: string, args: unknown, authorization = access) =>
      intake.fetch(
        new Request("https://intake.invalid/mcp", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authorization}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": "2025-11-25",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
          }),
        }),
      );
    return { ...f, dispatch, intake, call };
  }

  it("is inactive without touching dispatch or staging", async () => {
    const f = await setup(false);
    expect((await f.call("submit-authoring-request", {})).status).toBe(503);
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(await readdir(f.directory)).toEqual([]);
    await f.intake.close();
  });

  it("authenticates before serving tools and exposes no credentials", async () => {
    const f = await setup();
    expect(
      (await f.call("read-project-context", {}, "wrong".repeat(10))).status,
    ).toBe(403);
    const result = await f.call("read-project-context", {});
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.text()).toContain("projectNumber");
    expect(f.dispatch).not.toHaveBeenCalled();
    await f.intake.close();
  });

  it("submits through MCP once and never redispatches a lost first response", async () => {
    const f = await setup();
    f.dispatch.mockRejectedValueOnce(new Error("synthetic lost response"));
    const args = {
      envelope: f.envelope,
      payloadBase64: f.bytes.toString("base64"),
    };
    await (await f.call("submit-authoring-request", args)).text();
    const retry = await f.call("submit-authoring-request", args);
    expect(retry.status).toBe(200);
    expect(await retry.text()).toContain(f.request.requestId);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    await f.intake.close();
  });

  it("keeps job payloads and immutable results inside the authenticated private path", async () => {
    const f = await fixture();
    await f.store.seal(f.request, f.bytes);
    await f.store.claimDispatch(f.request.requestId);
    const intake = createAuthoringIntake({
      enabled: true,
      publicOrigin: "https://intake.invalid",
      maximumRequestBytes: 4096,
      callers: [{ subject: "fixture-agent", tokenDigest: "a".repeat(64) }],
      store: f.store,
      dispatch: vi.fn(),
      authenticateJob: async () => f.job,
      readProjectContext: vi.fn(),
    });
    const headers = {
      Authorization: `Bearer ${"synthetic-job-".repeat(4)}`,
      "Content-Type": "application/json",
    };
    const base = `https://intake.invalid/jobs/${f.request.requestId}`;
    const payload = await intake.fetch(
      new Request(`${base}/${payloadDigest(f.bytes)}`, { headers }),
    );
    expect(payload.status).toBe(200);
    expect(await payload.json()).toMatchObject({
      payloadBase64: f.bytes.toString("base64"),
    });
    const result = {
      status: "confirmed",
      canonicalUrls: ["https://github.com/Oxelio/architecture-web/issues/140"],
    };
    const recorded = await intake.fetch(
      new Request(`${base}/result`, {
        method: "POST",
        headers,
        body: JSON.stringify(result),
      }),
    );
    expect(recorded.status).toBe(200);
    expect(await f.store.result(f.request.requestId)).toEqual(result);
    expect(
      await f.store.fetchPayload(
        f.request.requestId,
        payloadDigest(f.bytes),
        f.job,
      ),
    ).toBeNull();
    const replacement = await intake.fetch(
      new Request(`${base}/result`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...result, status: "denied" }),
      }),
    );
    expect(replacement.status).toBe(403);
    await intake.close();
  });
});

it("accepts only the exact authenticated protected GitHub job", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const expected = {
    audience: "https://intake.invalid",
    environment: "delivery-authoring",
    subject: "repo:Oxelio/architecture-web:environment:delivery-authoring",
    workflowSha: "a".repeat(40),
  };
  const authenticate = createGitHubJobAuthenticator(
    expected,
    async () => publicKey,
  );
  const claims = {
    repository: "Oxelio/architecture-web",
    repository_id: "1336937640",
    repository_owner_id: "83680141",
    ref: "refs/heads/main",
    workflow_ref:
      "Oxelio/architecture-web/.github/workflows/delivery-authoring.yml@refs/heads/main",
    workflow_sha: expected.workflowSha,
    environment: expected.environment,
    event_name: "workflow_dispatch",
    run_id: "123",
    run_attempt: "1",
  };
  const sign = (overrides: object) =>
    new SignJWT({ ...claims, ...overrides })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience(expected.audience)
      .setSubject(expected.subject)
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("2m")
      .sign(privateKey);
  expect(await authenticate(await sign({}))).toEqual({
    runId: "123",
    runAttempt: "1",
    workflowSha: expected.workflowSha,
  });
  for (const changed of [
    { repository_id: "1" },
    { repository_owner_id: "1" },
    { ref: "refs/pull/147/merge" },
    { workflow_sha: "b".repeat(40) },
    { run_attempt: "2" },
    { environment: "another" },
    { job_workflow_ref: "unaccepted" },
  ]) {
    expect(await authenticate(await sign(changed))).toBeNull();
  }
  expect(await authenticate("not-a-signed-jwt")).toBeNull();
});

it("dispatches only the fixed workflow and does not repeat an uncertain request", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 204 }));
  const dispatch = createAuthoringDispatcher({
    readToken: async () => ({
      token: "synthetic",
      expiresAt: Date.now() + 1000,
    }),
    fetchImpl,
  });
  expect(await dispatch("a".repeat(64), "b".repeat(64))).toBe("dispatched");
  expect(fetchImpl.mock.calls[0]?.[0]).toBe(
    "https://api.github.com/repos/Oxelio/architecture-web/actions/workflows/delivery-authoring.yml/dispatches",
  );
  expect(JSON.parse(fetchImpl.mock.calls[0]?.[1].body as string)).toEqual({
    ref: "main",
    inputs: { request_id: "a".repeat(64), payload_digest: "b".repeat(64) },
  });
  fetchImpl.mockRejectedValueOnce(new Error("lost"));
  expect(await dispatch("a".repeat(64), "b".repeat(64))).toBe("uncertain");
  expect(await dispatch("wrong", "b".repeat(64))).toBe("denied");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});
