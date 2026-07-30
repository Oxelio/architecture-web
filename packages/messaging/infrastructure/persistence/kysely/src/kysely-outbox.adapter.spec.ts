import { describe, expect, it } from "vitest";

import { outboxRowToEntity } from "./kysely-outbox.adapter.js";

describe("outboxRowToEntity", () => {
  it("rehydrates the outbox aggregate from persistence", () => {
    const occurredAt = new Date("2026-01-01T00:00:00.000Z");
    const message = outboxRowToEntity({
      id: "event-1",
      topic: "iam.user-registered",
      version: 1,
      aggregate_id: "user-1",
      occurred_at: occurredAt,
      payload: JSON.stringify({ userId: "user-1" }),
      context: JSON.stringify({ actorType: "user" }),
      status: "processing",
      attempts: 0,
      available_at: occurredAt,
      claimed_at: occurredAt,
      published_at: null,
      last_error: null,
    });

    expect(message.event.payload).toEqual({ userId: "user-1" });
    expect(message.status).toBe("processing");
  });
});
