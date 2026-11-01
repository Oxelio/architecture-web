import { describe, expect, it } from "vitest";

import { NotificationSeverityValueObject } from "../value-objects/notification-severity.value-object.js";
import { NotificationEntity } from "./notification.entity.js";

describe("NotificationEntity", () => {
  it("creates a valid aggregate and marks it as read once", () => {
    const severity = NotificationSeverityValueObject.create("critical");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const notification = NotificationEntity.create(
      {
        recipientId: "user-1",
        sourceEventId: "event-1",
        type: "iam.user-password-changed",
        severity: severity.value,
        title: "Password changed",
        message: "Your password changed.",
        deliveries: [
          {
            channel: "email",
            destination: "user@example.test",
            audience: "affected_user",
          },
        ],
      },
      createdAt,
    );

    expect(notification.markRead(new Date("2026-01-02T00:00:00.000Z"))).toBe(
      true,
    );
    expect(notification.markRead(new Date("2026-01-03T00:00:00.000Z"))).toBe(
      false,
    );

    expect(notification.deliveries).toHaveLength(1);
    expect(notification.readAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));
  });
});
