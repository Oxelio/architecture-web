import { describe, expect, it } from "vitest";

import { OutboxMessageEntity } from "./outbox-message.entity.js";

describe("OutboxMessageEntity", () => {
  it("moves a claimed message to failed and schedules a retry", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const message = OutboxMessageEntity.rehydrate({
      event: {
        eventId: "event-1",
        topic: "iam.user-registered",
        version: 1,
        aggregateId: "user-1",
        occurredAt: now,
        payload: {},
        context: {},
      },
      status: "processing",
      attempts: 1,
      availableAt: now,
      claimedAt: now,
      publishedAt: null,
      lastError: null,
    });

    message.markFailed(new Error("unavailable"), now);

    expect(message.status).toBe("failed");
    expect(message.attempts).toBe(1);
    expect(message.availableAt).toEqual(new Date("2026-01-01T00:00:02.000Z"));
    expect(message.lastError).toContain("unavailable");
  });
});
