import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import { runProtectedAuthoringJob } from "./run-protected-authoring-job.js";

it("keeps a lost response pending and reports only a terminal matching journal entry", async () => {
  const payload = Buffer.from('{"title":"test"}');
  const expectedPayloadDigest = createHash("sha256")
    .update(payload)
    .digest("hex");
  const request = prepareAuthoringRequest({
    authenticatedSubject: "fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey: "11111111-1111-4111-8111-111111111111",
      command: {
        kind: "edit-work",
        beforeStateDigest: "a".repeat(64),
        payloadDigest: expectedPayloadDigest,
      },
    },
  });
  if (!request) {
    throw new Error("Invalid fixture");
  }
  const { requestId, commandDigest, actorDigest } = request;
  const journalReader = {
    readAuthoringRequest: vi.fn().mockResolvedValue(null),
  };
  const fetchImpl = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({ status: "recorded" })
        : Response.json({
            request,
            createdAt: 1000,
            expiresAt: 3000,
            payloadBase64: payload.toString("base64"),
          }),
  );
  const operation = vi.fn().mockResolvedValue(null);
  const input = {
    enabled: true,
    workflowSha: "e".repeat(40),
    intakeOrigin: "https://intake.invalid",
    maximumExchangeBytes: 4096,
    maximumHistoryRevisions: 20,
    requestId,
    expectedPayloadDigest,
    getJobToken: async () => "synthetic",
    journalReader,
    fetchImpl,
    now: () => 2000,
    ports: {
      journal: {
        readAuthoringBoundary: vi.fn().mockResolvedValue({
          position: null,
          reservation: null,
          projectStatus: null,
          authoring: [],
        }),
        beginAuthoringWrite: vi.fn(),
        finishAuthoringWrite: vi.fn(),
      },
      verifyBoundary: async () => true,
      resolve: operation,
      cancelOrResolve: vi.fn(),
      authorizeRecovery: vi.fn(),
    },
  };
  expect(await runProtectedAuthoringJob(input)).toBe("deferred");
  expect(
    fetchImpl.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toHaveLength(0);
  journalReader.readAuthoringRequest.mockResolvedValue({
    outcome: "known-unstarted",
    intent: { requestId, commandDigest, actorDigest },
  });
  expect(await runProtectedAuthoringJob(input)).toBe("reported");
  expect(JSON.parse(String(fetchImpl.mock.calls.at(-1)?.[1]?.body))).toEqual({
    status: "denied",
    canonicalUrls: [],
  });
  expect(input.ports.journal.beginAuthoringWrite).not.toHaveBeenCalled();
});
