import { describe, expect, it } from "vitest";

import { notificationRowToEntity } from "./notification.mapper.js";

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
