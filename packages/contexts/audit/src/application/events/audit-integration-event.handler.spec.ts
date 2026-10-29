import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "#repositories/audit.repository";
import { AuditApplication } from "#services/audit.application";

import { AuditIntegrationEventHandler } from "./audit-integration-event.handler.js";

describe("AuditIntegrationEventHandler", () => {
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
