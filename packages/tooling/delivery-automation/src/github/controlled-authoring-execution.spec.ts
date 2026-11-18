import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import {
  prepareAuthoringRequest,
  projectAuthoringIntent,
} from "../control/authoring-request.js";
import type { ControlledWriteScope } from "../control/controlled-write.js";
import {
  type AuthoringExecutionPorts,
  executeControlledAuthoring,
  reconcileControlledAuthoring,
} from "./controlled-authoring-execution.js";

function fixture() {
  const payload = Buffer.from("synthetic operation");
  const request = prepareAuthoringRequest({
    authenticatedSubject: "fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey: "11111111-1111-4111-8111-111111111111",
      command: {
        kind: "edit-work",
        beforeStateDigest: "b".repeat(64),
        payloadDigest: createHash("sha256").update(payload).digest("hex"),
      },
    },
  });
  if (!request) {
    throw new Error("Invalid fixture");
  }
  const scope: ControlledWriteScope = {
    repositoryId: 1336937640,
    kind: "edit-work",
    affectedWorks: [140],
    affectedPulls: [],
    affectedRefs: [],
  };
  const authorityDigest = "c".repeat(64);
  const intent = projectAuthoringIntent({ request, scope, authorityDigest });
  if (!intent) {
    throw new Error("Invalid fixture intent");
  }
  const position = { revision: 1, tagSha: "d".repeat(40) };
  const readAuthoringBoundary = vi
    .fn<AuthoringExecutionPorts["journal"]["readAuthoringBoundary"]>()
    .mockResolvedValue({
      position: null,
      reservation: null,
      projectStatus: null,
      authoring: [],
    });
  const beginAuthoringWrite = vi
    .fn<AuthoringExecutionPorts["journal"]["beginAuthoringWrite"]>()
    .mockResolvedValue({
      status: "admitted",
      admission: { intent, admissionRevision: 1 },
      position,
    });
  const finishAuthoringWrite = vi
    .fn<AuthoringExecutionPorts["journal"]["finishAuthoringWrite"]>()
    .mockResolvedValue("settled");
  const perform = vi
    .fn()
    .mockResolvedValue({ outcome: "confirmed", proofDigest: "e".repeat(64) });
  const isCurrent = vi.fn().mockResolvedValue(true);
  const ports: AuthoringExecutionPorts = {
    journal: {
      readAuthoringBoundary,
      beginAuthoringWrite,
      finishAuthoringWrite,
    },
    verifyBoundary: vi.fn().mockResolvedValue(true),
    resolve: vi.fn().mockResolvedValue({
      scope,
      reserved: null,
      inventoryComplete: true,
      authorityDigest,
      isCurrent,
      readAuthority: async () => authorityDigest,
      perform,
    }),
    cancelOrResolve: vi.fn(),
    authorizeRecovery: vi.fn().mockResolvedValue(true),
  };
  const input = {
    enabled: true,
    workflowSha: "f".repeat(40),
    maximumHistoryRevisions: 100,
    request,
    payload,
    ports,
  };
  return {
    input,
    ports,
    perform,
    isCurrent,
    scope,
    readAuthoringBoundary,
    beginAuthoringWrite,
    finishAuthoringWrite,
    admission: { intent, admissionRevision: 1 },
  };
}

it("does not touch credentials or the journal while inactive", async () => {
  const f = fixture();
  expect(await executeControlledAuthoring({ ...f.input, enabled: false })).toBe(
    "inactive",
  );
  expect(f.ports.verifyBoundary).not.toHaveBeenCalled();
  expect(f.beginAuthoringWrite).not.toHaveBeenCalled();
});

it("keeps an armed reservation in place when the invalidating request has lost authority", async () => {
  const f = fixture();
  const reservation = {
    candidate: {
      workNumber: 140,
      pullNumber: 147,
      headSha: "a".repeat(40),
      baseSha: "b".repeat(40),
    },
    state: { phase: "armed" as const, checkId: 567 },
  };
  f.readAuthoringBoundary.mockResolvedValue({
    authoring: [],
    projectStatus: null,
    position: null,
    reservation: {
      reservation,
      revision: 1,
      reservationId: "delivery-control/r1",
      nativePosition: { revision: 1, tagSha: "c".repeat(40) },
    },
  });
  const resolve = async () => ({
    scope: f.scope,
    reserved: {
      reservation,
      relevantWorks: [140],
      relevantPulls: [147],
      relevantRefs: ["refs/heads/main"],
    },
    inventoryComplete: true,
    authorityDigest: "a".repeat(64),
    isCurrent: async () => true,
    readAuthority: async () => null,
    perform: f.perform,
  });
  expect(
    await executeControlledAuthoring({
      ...f.input,
      ports: { ...f.ports, resolve },
    }),
  ).toBe("denied");
  expect(f.ports.cancelOrResolve).not.toHaveBeenCalled();
  expect(f.beginAuthoringWrite).not.toHaveBeenCalled();
});

it("permits one handoff only after a positively won admission", async () => {
  const f = fixture();
  expect(await executeControlledAuthoring(f.input)).toBe("settled");
  expect(f.perform).toHaveBeenCalledTimes(1);
  f.beginAuthoringWrite.mockResolvedValue({ status: "pending" });
  expect(await executeControlledAuthoring(f.input)).toBe("deferred");
  expect(f.perform).toHaveBeenCalledTimes(1);
});

it("records known non-entry when eligibility for the handoff is revoked after admission", async () => {
  const f = fixture();
  f.isCurrent.mockResolvedValueOnce(true).mockResolvedValue(false);
  expect(await executeControlledAuthoring(f.input)).toBe("settled");
  expect(f.perform).not.toHaveBeenCalled();
  const completion = f.finishAuthoringWrite.mock.calls[0]?.[0];
  expect(await completion?.observeOutcome(f.admission)).toMatchObject({
    outcome: "known-unstarted",
  });
});

it("leaves uncertain handoff pending and makes recovery observe without another mutation", async () => {
  const f = fixture();
  f.perform.mockRejectedValue(new Error("lost response"));
  expect(await executeControlledAuthoring(f.input)).toBe("deferred");
  expect(f.finishAuthoringWrite).not.toHaveBeenCalled();
  await reconcileControlledAuthoring({
    enabled: true,
    requestId: f.input.request.requestId,
    maximumHistoryRevisions: 100,
    journal: f.ports.journal,
    verifyBoundary: f.ports.verifyBoundary,
    authorizeRecovery: f.ports.authorizeRecovery,
    observeOutcome: async () => null,
  });
  expect(f.perform).toHaveBeenCalledTimes(1);
  expect(f.finishAuthoringWrite).toHaveBeenCalledTimes(1);
});
