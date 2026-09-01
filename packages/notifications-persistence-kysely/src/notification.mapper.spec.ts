import { describe, expect, it } from "vitest";

import {
  claimableNotificationRowsToEntities,
  claimableNotificationRowToEntity,
  notificationPreferenceRowToEntity,
  notificationRowToEntity,
} from "./notification.mapper.js";

describe("notificationRowToEntity", () => {
  it("rehydrates persisted notification business values", () => {
    const notification = notificationRowToEntity({
      id: "notification-1",
      recipient_id: "user-1",
      source_event_id: "event-1",
      type: "iam.user-registered",
      severity: "information",
      title: "Account created",
      message: "Your account has been created.",
      action_url: "/profile",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      read_at: null,
      archived_at: null,
    });

    expect(notification.identifier.value).toBe("notification-1");
    expect(notification.severity.value).toBe("information");
  });
});

describe("notificationPreferenceRowToEntity", () => {
  it("rehydrates preference ownership and state", () => {
    const preference = notificationPreferenceRowToEntity({
      user_id: "user-1",
      channel: "email",
      enabled: false,
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(preference.identifier.value).toBe("user-1:email");
    expect(preference.enabled).toBe(false);
  });
});

describe("claimableNotificationRowToEntity", () => {
  it("rehydrates the notification aggregate with its delivery", () => {
    const row = {
      notification_id: "notification-1",
      recipient_id: "user-1",
      source_event_id: "event-1",
      type: "iam.user-registered",
      severity: "information",
      title: "Account created",
      message: "Your account has been created.",
      action_url: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      read_at: null,
      archived_at: null,
      delivery_id: "delivery-1",
      channel: "email",
      destination: "user@example.test",
      status: "pending",
      attempts: 0,
      available_at: new Date("2026-01-01T00:00:00.000Z"),
      claimed_at: null,
      sent_at: null,
      last_error: null,
    } as const;
    const notification = claimableNotificationRowToEntity(row);

    expect(notification.identifier.value).toBe("notification-1");
    expect(notification.deliveries[0]?.identifier.value).toBe("delivery-1");

    const grouped = claimableNotificationRowsToEntities([
      row,
      { ...row, delivery_id: "delivery-2", channel: "sms" },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.deliveries).toHaveLength(2);
  });
});
