import { expect, it } from "vitest";

import type { PreparedAuthoringRequest } from "../control/authoring-request.js";
import {
  createProtectedAuthoringAuthority,
  type ProtectedAuthoringChannel,
} from "./protected-authoring-authority.js";

const baseSha = "a".repeat(40);
const sourceRef = "refs/heads/codex/work-140";
const commandDigest = "b".repeat(64);
const actorDigest = "c".repeat(64);
const request: PreparedAuthoringRequest = {
  schema: 1,
  repositoryId: 1336937640,
  workNumber: 140,
  actorDigest,
  commandDigest,
  requestId: "d".repeat(64),
  command: {
    kind: "create-pull-request",
    sourceRef,
    headSha: "e".repeat(40),
    baseSha,
    payloadDigest: "e".repeat(64),
    beforeStateDigest: "f".repeat(64),
  },
};
const channel: ProtectedAuthoringChannel = {
  kind: "protected-authoring-channel",
  repositoryId: 1336937640,
  projectNumber: 3,
  workflowPath: ".github/workflows/delivery-authoring.yml",
  intakeOrigin: "https://fixture.example",
  dispatchActorId: 123,
  approvedControlRevision: baseSha,
  authoringAppId: 321,
  authoringInstallationId: 432,
  authoringBotId: 543,
  expiresAt: "2027-12-01T00:00:00.000Z",
  permissions: [
    {
      actorDigest,
      workNumber: 140,
      kinds: ["create-pull-request", "record-evidence", "record-project-field"],
      commandDigests: [commandDigest],
      source: {
        ref: sourceRef,
        baseSha,
        paths: ["apps/example/"],
        allowNonFastForward: false,
      },
    },
  ],
};

it("binds PR creation to the actor, Work, source and approved base", async () => {
  let current: ProtectedAuthoringChannel | null = channel;
  const verify = createProtectedAuthoringAuthority({
    readChannel: async () => current,
    readStatusCommand: async () => null,
    statusFieldId: "Status",
    now: () => Date.parse("2027-11-01T00:00:00Z"),
  });
  const grant = await verify(request);
  expect(grant).toBeTruthy();
  await expect(grant?.readAuthority()).resolves.toBe(grant?.authorityDigest);
  for (const invalid of [
    { ...request, actorDigest: "0".repeat(64) },
    { ...request, workNumber: 141 },
    { ...request, command: { ...request.command, baseSha: "0".repeat(40) } },
    {
      ...request,
      command: { ...request.command, sourceRef: "refs/heads/codex/other" },
    },
  ]) {
    await expect(verify(invalid)).resolves.toBeNull();
  }
  current = {
    ...channel,
    permissions: [...channel.permissions, ...channel.permissions],
  };
  await expect(verify(request)).resolves.toBeNull();
  current = null;
  await expect(grant?.readAuthority()).resolves.toBeNull();
});

it("requires an exact evidence grant and independent authorization for Status", async () => {
  const verify = createProtectedAuthoringAuthority({
    readChannel: async () => channel,
    readStatusCommand: async () => null,
    statusFieldId: "Status",
    now: () => Date.parse("2027-11-01T00:00:00Z"),
  });
  const evidence: PreparedAuthoringRequest = {
    ...request,
    command: {
      kind: "record-evidence",
      payloadDigest: "e".repeat(64),
      beforeStateDigest: "f".repeat(64),
    },
  };
  await expect(verify(evidence)).resolves.toBeTruthy();
  await expect(
    verify({ ...evidence, commandDigest: "0".repeat(64) }),
  ).resolves.toBeNull();
  await expect(
    verify({
      ...evidence,
      command: {
        kind: "record-project-field",
        fieldId: "Status",
        projectNumber: 3,
        itemId: "fixture-item",
        payloadDigest: "e".repeat(64),
        beforeStateDigest: "f".repeat(64),
      },
    }),
  ).resolves.toBeNull();
});
