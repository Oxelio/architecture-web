import { describe, expect, it, vi } from "vitest";

import { IntegrationEventRouter } from "./integration-event-router.js";

describe("IntegrationEventRouter", () => {
  it("dispatches an event only to handlers subscribed to its topic", async () => {
    const matching = vi.fn();
    const ignored = vi.fn();
    const router = new IntegrationEventRouter([
      { topics: ["iam.user-registered"], handle: matching },
      { topics: ["iam.user-suspended"], handle: ignored },
    ]);

    await router.dispatch({
      eventId: "event-1",
      topic: "iam.user-registered",
      version: 1,
      aggregateId: "user-1",
      occurredAt: new Date(),
      payload: { userId: "user-1" },
      context: {},
    });

    expect(matching).toHaveBeenCalledOnce();
    expect(ignored).not.toHaveBeenCalled();
  });
});
