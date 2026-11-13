import { describe, expect, it, vi } from "vitest";

import { readStandingDelegation } from "./standing-delegation.js";

const context = {
  repository: "Oxelio/architecture-web",
  repositoryId: 1336937640,
  ref: "refs/heads/main",
  workflowSha: "a".repeat(40),
  runAttempt: "1",
};
const record = {
  kind: "standing-work-integration",
  repositoryId: 1336937640,
  controllerBotId: 42,
  workflowPath: ".github/workflows/delivery-work-integration-request.yml",
  expiresAt: "2026-11-14T00:00:00Z",
  gatePublication: true,
  nativeSquash: true,
};
const now = Date.parse("2026-11-13T00:00:00Z");

describe("standing delegation observation", () => {
  it("reads the current direct decision each time and keeps the capabilities separate", async () => {
    const readMaintainerRecord = vi.fn(async () => record);
    const input = { context, controllerBotId: 42, now, readMaintainerRecord };
    expect(await readStandingDelegation(input)).toEqual({
      repositoryId: context.repositoryId,
      controllerBotId: 42,
      workflowSha: context.workflowSha,
      gatePublication: true,
      nativeSquash: true,
    });
    readMaintainerRecord.mockResolvedValue({ ...record, nativeSquash: false });
    expect(await readStandingDelegation(input)).toMatchObject({
      gatePublication: true,
      nativeSquash: false,
    });
    expect(readMaintainerRecord).toHaveBeenCalledTimes(2);
  });

  it("fails closed on a changed binding, expired decision, missing record, or transport failure", async () => {
    const input = { context, controllerBotId: 42, now };
    for (const value of [
      null,
      { ...record, repositoryId: 9 },
      { ...record, controllerBotId: 9 },
      { ...record, workflowPath: ".github/workflows/other.yml" },
      { ...record, expiresAt: "2026-11-13T00:00:00Z" },
      { ...record, gatePublication: "true" },
    ]) {
      expect(
        await readStandingDelegation({
          ...input,
          readMaintainerRecord: async () => value,
        }),
      ).toBeNull();
    }
    expect(
      await readStandingDelegation({
        ...input,
        readMaintainerRecord: async () => {
          throw Error("unavailable");
        },
      }),
    ).toBeNull();
  });

  it("rejects invalid invocation context before fetching authority", async () => {
    const readMaintainerRecord = vi.fn(async () => record);
    for (const change of [
      { ref: "refs/heads/candidate" },
      { runAttempt: "2" },
      { workflowSha: "invalid" },
    ]) {
      expect(
        await readStandingDelegation({
          context: { ...context, ...change },
          controllerBotId: 42,
          now,
          readMaintainerRecord,
        }),
      ).toBeNull();
    }
    expect(readMaintainerRecord).not.toHaveBeenCalled();
  });
});
