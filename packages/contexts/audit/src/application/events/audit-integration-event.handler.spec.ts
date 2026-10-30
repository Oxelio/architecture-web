import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";
import { AuditApplication } from "#services/audit.application";

import { AuditIntegrationEventHandler } from "./audit-integration-event.handler.js";

describe("AuditIntegrationEventHandler", () => {
  it.each([
    ["iam.session-started", 1],
    ["iam.session-started", 999],
    ["iam.user-password-changed", 2],
  ])("rejects unsupported %s v%s before writing", async (topic, version) => {
    const record = vi.fn(),
      handler = new AuditIntegrationEventHandler(
        { record },
        { getRetentionDays: async () => 365 },
      );
    await expect(
      handler.handle({
        eventId: "event",
        topic,
        version,
        aggregateId: "account",
        occurredAt: new Date(),
        payload: { userId: "account" },
        context: {},
      }),
    ).rejects.toThrow("version");
    expect(record).not.toHaveBeenCalled();
  });
  it("rejects a malformed current fact and accepts the current session contract", async () => {
    const record = vi.fn(),
      handler = new AuditIntegrationEventHandler(
        { record },
        { getRetentionDays: async () => 365 },
      );
    const event = {
      eventId: "event",
      topic: "iam.session-started",
      version: 2,
      aggregateId: "account",
      occurredAt: new Date(),
      payload: {},
      context: {},
    };
    await expect(handler.handle(event)).rejects.toThrow("subject");
    await handler.handle({ ...event, payload: { userId: "account" } });
    expect(record).toHaveBeenCalledOnce();
  });
  it("turns an IAM integration event into an idempotent audit entry", async () => {
    const append = vi.fn();
    const repository = {
      append,
    } as unknown as AuditRepository;
    const handler = new AuditIntegrationEventHandler(
      new AuditApplication(repository),
      { getRetentionDays: async () => 365 },
    );

    await handler.handle({
      eventId: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
      topic: "iam.user-password-changed",
      version: 1,
      aggregateId: "user-1",
      occurredAt: new Date("2026-01-01T00:00:00Z"),
      payload: { userId: "user-1" },
      context: {
        actorType: "user",
        actorId: "user-1",
        subjectId: "user-1",
      },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
        type: "iam.user-password-changed",
        result: "success",
      }),
    );
  });
});
