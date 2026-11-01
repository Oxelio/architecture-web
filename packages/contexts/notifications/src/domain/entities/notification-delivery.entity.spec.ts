import { describe, expect, it } from "vitest";

import { NotificationChannelValueObject } from "../value-objects/notification-channel.value-object.js";
import { NotificationDeliveryIdentifierValueObject } from "../value-objects/notification-identifier.value-object.js";
import { NotificationDeliveryEntity } from "./notification-delivery.entity.js";

function createDelivery(now: Date): NotificationDeliveryEntity {
  const channel = NotificationChannelValueObject.create("email");
  const identifier =
    NotificationDeliveryIdentifierValueObject.create("delivery-1");
  if (!channel.success || !identifier.success) {
    throw new Error("Test fixture is invalid");
  }
  return NotificationDeliveryEntity.create(
    {
      identifier: identifier.value,
      channel: channel.value,
      destination: "user@example.test",
      audience: "affected_user",
    },
    now,
  );
}

describe("NotificationDeliveryEntity", () => {
  it("permanently suppresses a claimed unauthorized delivery without retrying", () => {
    const now = new Date();
    const delivery = createDelivery(now);
    expect(() => delivery.suppress("administrator_not_authorized")).toThrow();
    delivery.claim(now);
    delivery.suppress("administrator_not_authorized");
    expect(delivery.status).toBe("suppressed");
    expect(delivery.suppressionReason).toBe("administrator_not_authorized");
    expect(delivery.claimedAt).toBeNull();
    expect(delivery.sentAt).toBeNull();
    expect(delivery.claim(now)).toBe(false);
    expect(delivery.attempts).toBe(1);
  });
  it("owns the claim and success transitions", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const delivery = createDelivery(now);

    expect(delivery.attempts).toBe(0);
    expect(delivery.claim(now)).toBe(true);
    expect(delivery.attempts).toBe(1);
    expect(delivery.claim(now)).toBe(false);
    expect(delivery.attempts).toBe(1);
    delivery.markSent(new Date("2026-01-01T00:00:01.000Z"));

    expect(delivery.status).toBe("sent");
    expect(delivery.attempts).toBe(1);
    expect(delivery.claim(now)).toBe(false);
    expect(delivery.attempts).toBe(1);
    expect(delivery.sentAt).toEqual(new Date("2026-01-01T00:00:01.000Z"));
  });

  it("owns retry scheduling after a delivery failure", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const delivery = createDelivery(now);
    delivery.claim(now);

    delivery.markFailed(
      new Error("provider unavailable"),
      new Date("2026-01-01T00:00:01.000Z"),
    );

    expect(delivery.status).toBe("failed");
    expect(delivery.attempts).toBe(1);
    expect(delivery.availableAt).toEqual(new Date("2026-01-01T00:00:03.000Z"));
    expect(delivery.lastError).toBe("Error: provider unavailable");
  });

  it("dead-letters the tenth failed claim without counting failure twice", () => {
    const delivery = createDelivery(new Date("2026-01-01T00:00:00.000Z"));

    for (let attempt = 1; attempt <= 10; attempt++) {
      const now = delivery.availableAt;
      expect(delivery.claim(now)).toBe(true);
      expect(delivery.attempts).toBe(attempt);
      delivery.markFailed(new Error("provider unavailable"), now);
      expect(delivery.attempts).toBe(attempt);
      expect(delivery.status).toBe(attempt === 10 ? "dead_letter" : "failed");
    }

    expect(delivery.claim(delivery.availableAt)).toBe(false);
    expect(delivery.attempts).toBe(10);
  });
});
