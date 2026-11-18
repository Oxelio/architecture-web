import { createHash } from "node:crypto";

import { expect, it, vi } from "vitest";

import { prepareAuthoringRequest } from "../control/authoring-request.js";
import type { ControlledWriteScope } from "../control/controlled-write.js";
import {
  authoringMetadataBeforeDigest,
  readAuthoringMetadataSnapshot,
  resolveAuthoringMetadataOperation,
} from "./authoring-metadata-operation.js";
import {
  projectStatusBeforeDigest,
  resolveAuthoringStatusOperation,
} from "./authoring-status-operation.js";
import type { ProjectStatusCommand } from "./project-status-command.js";
import type { ProjectStatusBinding } from "./run-coordinated-status-write.js";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const authorityDigest = "a".repeat(64);
const scope = (kind: ControlledWriteScope["kind"]): ControlledWriteScope => ({
  repositoryId: 1336937640,
  kind,
  affectedWorks: [140],
  affectedPulls: [147],
  affectedRefs: [],
});
function prepare(command: object) {
  const request = prepareAuthoringRequest({
    authenticatedSubject: "fixture",
    envelope: {
      schema: 1,
      repositoryId: 1336937640,
      workNumber: 140,
      clientKey: "11111111-1111-4111-8111-111111111111",
      command,
    },
  });
  if (!request) {
    throw new Error("Invalid fixture");
  }
  return request;
}

it.each(["edit-work", "edit-pull-request"] as const)(
  "publishes one exact %s metadata change and checks its canonical result",
  async (kind) => {
    const payload = Buffer.from(JSON.stringify({ body: "new synthetic body" }));
    let current = {
      id: 1,
      number: kind === "edit-work" ? 140 : 147,
      title: "fixture",
      body: "old body",
      state: "open",
      updated_at: "2026-11-18T08:00:00Z",
      repository_url: "https://api.github.com/repos/Oxelio/architecture-web",
      ...(kind === "edit-pull-request"
        ? {
            draft: true,
            head: { sha: "b".repeat(40), repo: { id: 1336937640 } },
            base: {
              sha: "c".repeat(40),
              ref: "main",
              repo: { id: 1336937640 },
            },
          }
        : {}),
    };
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          current = {
            ...current,
            body: "new synthetic body",
            updated_at: "2026-11-18T08:01:00Z",
          };
        }
        return Response.json(current);
      },
    );
    const command = {
      kind,
      beforeStateDigest: "d".repeat(64),
      payloadDigest: hash(payload),
      ...(kind === "edit-pull-request"
        ? { pullNumber: 147, headSha: "b".repeat(40), baseSha: "c".repeat(40) }
        : {}),
    };
    const initial = await readAuthoringMetadataSnapshot({
      request: prepare(command),
      readToken: "synthetic-reader",
      fetchImpl,
    });
    if (!initial) {
      throw new Error("Missing fixture snapshot");
    }
    const request = prepare({
      ...command,
      beforeStateDigest: authoringMetadataBeforeDigest(initial),
    });
    const input = {
      request,
      payload,
      readToken: "synthetic-reader",
      authoringToken: "synthetic-writer",
      fetchImpl,
      scope: scope(kind),
      reserved: null,
      inventoryComplete: true,
      authorityDigest,
      readAuthority: async () => authorityDigest,
    };
    const operation = await resolveAuthoringMetadataOperation(input);
    expect(operation).not.toBeNull();
    expect(await operation?.perform(async () => false)).toMatchObject({
      outcome: "known-unstarted",
    });
    expect(
      fetchImpl.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(0);
    expect(await operation?.perform(async () => true)).toMatchObject({
      outcome: "confirmed",
    });
    expect(
      fetchImpl.mock.calls.filter(([, init]) => init?.method === "PATCH"),
    ).toHaveLength(1);
    expect(await operation?.isCurrent()).toBe(false);
    expect(await resolveAuthoringMetadataOperation(input)).toBeNull();
    expect(
      await resolveAuthoringMetadataOperation({
        ...input,
        payload: Buffer.from(JSON.stringify({ merge: true })),
      }),
    ).toBeNull();
  },
);

it("routes a validated Status transition through scoped admission without the legacy global slot", async () => {
  const command: ProjectStatusCommand = {
    kind: "record-work-status",
    repositoryId: 1336937640,
    projectNumber: 3,
    workNumber: 140,
    from: "Ready",
    to: "Implementing",
    statusUpdatedAt: "2026-11-18T08:00:00Z",
    evidenceCommentIds: [1],
  };
  const payload = Buffer.from(JSON.stringify(command));
  const snapshot = {
    name: "Ready",
    updatedAt: command.statusUpdatedAt,
    binding: {
      projectId: "PVT_kwHOBPzbjc4Bgts6",
      itemId: "item",
      fieldId: "field",
      fromOptionId: "ready",
      toOptionId: "implementing",
    },
  };
  let current = snapshot;
  const writer = {
    readStatus: vi.fn(async () => current),
    writeStatus: vi.fn(
      async (
        _command: ProjectStatusCommand,
        _binding: ProjectStatusBinding,
        authorize: () => Promise<boolean>,
      ): Promise<"unstarted" | "confirmed" | "unverified"> => {
        if (!(await authorize())) {
          return "unstarted";
        }
        current = {
          ...snapshot,
          name: "Implementing",
          updatedAt: "2026-11-18T08:01:00Z",
        };
        return "confirmed";
      },
    ),
  };
  const request = prepare({
    kind: "record-project-field",
    projectNumber: 3,
    itemId: "item",
    fieldId: "field",
    beforeStateDigest: projectStatusBeforeDigest(snapshot),
    payloadDigest: hash(payload),
  });
  const operation = await resolveAuthoringStatusOperation({
    request,
    payload,
    authenticatedCommand: command,
    writer,
    scope: scope("record-project-field"),
    reserved: null,
    inventoryComplete: true,
    authorityDigest,
    readAuthority: async () => authorityDigest,
  });
  expect(operation).not.toBeNull();
  expect(await operation?.perform(async () => false)).toMatchObject({
    outcome: "known-unstarted",
  });
  expect(await operation?.perform(async () => true)).toMatchObject({
    outcome: "confirmed",
  });
  expect(await operation?.isCurrent()).toBe(false);
  writer.writeStatus.mockResolvedValue("unverified");
  expect(await operation?.perform(async () => true)).toBeNull();
});
