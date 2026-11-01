import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";
import { AuditApplication } from "#services/audit.application";

import { AuditIntegrationEventHandler } from "./audit-integration-event.handler.js";

describe("AuditIntegrationEventHandler", () => {
  it("uses producer payload references when context omits them and rejects contradictions", async () => {
    const record = vi.fn();
    const handler = new AuditIntegrationEventHandler(
      { record, removeAccountReferences: vi.fn() },
      { getRetentionDays: async () => 365 },
    );
    const event = {
      eventId: "event",
      topic: "iam.user-role-changed",
      version: 1,
      aggregateId: "user",
      occurredAt: new Date(),
      payload: { userId: "user", actorId: "admin" },
      context: { actorType: "administrator" },
    };
    await handler.handle(event);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          actorType: "administrator",
          actorId: "admin",
          subjectId: "user",
        },
      }),
    );
    record.mockClear();
    await expect(
      handler.handle({
        ...event,
        context: { ...event.context, subjectId: "different" },
      }),
    ).rejects.toThrow("Inconsistent");
    expect(record).not.toHaveBeenCalled();
  });
  it.each(["administrator", "system", "anonymous", "user", "unexpected"])(
    "preserves the audit actor for %s",
    async (actorType) => {
      const record = vi.fn();
      const handler = new AuditIntegrationEventHandler(
        { record, removeAccountReferences: vi.fn() },
        { getRetentionDays: () => Promise.resolve(365) },
      );
      await handler.handle({
        eventId: "event",
        topic: "account.deletion.executed",
        version: 1,
        aggregateId: "pseudonym",
        occurredAt: new Date(),
        payload: { pseudonymousSubject: "pseudonym" },
        context: { actorType },
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            actorType: actorType === "unexpected" ? "user" : actorType,
          },
        }),
      );
    },
  );

  it.each([
    { version: "1", changedKeys: [], justification: "reason" },
    { version: 1, changedKeys: null, justification: "reason" },
    { version: 1, changedKeys: [1], justification: "reason" },
    { version: 1, changedKeys: [], justification: null },
  ])(
    "refuses malformed configuration facts before writing",
    async (payload) => {
      const record = vi.fn();
      const handler = new AuditIntegrationEventHandler(
        { record, removeAccountReferences: vi.fn() },
        { getRetentionDays: () => Promise.resolve(365) },
      );
      await expect(
        handler.handle({
          eventId: "event",
          topic: "security.config.published",
          version: 1,
          aggregateId: "revision",
          occurredAt: new Date(),
          payload,
          context: {},
        }),
      ).rejects.toThrow("Invalid configuration event");
      expect(record).not.toHaveBeenCalled();
    },
  );
  it.each([
    ["iam.session-started", 1],
    ["iam.session-started", 999],
    ["iam.user-password-changed", 2],
  ])("rejects unsupported %s v%s before writing", async (topic, version) => {
    const record = vi.fn(),
      handler = new AuditIntegrationEventHandler(
        { record, removeAccountReferences: vi.fn() },
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
        { record, removeAccountReferences: vi.fn() },
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
      new AuditApplication(repository, {
        reference: (id) => `pseudonym-${id}`,
      }),
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
