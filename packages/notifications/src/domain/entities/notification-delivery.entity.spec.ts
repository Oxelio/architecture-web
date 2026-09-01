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
    },
    now,
  );
}

describe("NotificationDeliveryEntity", () => {
  it("owns the claim and success transitions", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const delivery = createDelivery(now);

    expect(delivery.claim(now)).toBe(true);
    delivery.markSent(new Date("2026-01-01T00:00:01.000Z"));

    expect(delivery.status).toBe("sent");
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
});
