import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

import { SlackWebhookNotificationDeliveryAdapter } from "./slack-webhook-notification-delivery.adapter.js";

describe("SlackWebhookNotificationDeliveryAdapter", () => {
  it("reports a rejected webhook delivery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const adapter = new SlackWebhookNotificationDeliveryAdapter(
      "https://example.test/hook",
    );
    const severity = NotificationSeverityValueObject.create("critical");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const notification = NotificationEntity.create({
      recipientId: "admin-1",
      sourceEventId: "event-1",
      type: "security.suspicious-activity-detected",
      severity: severity.value,
      title: "Alert",
      message: "Suspicious activity",
      deliveries: [{ channel: "slack", destination: "security" }],
    });
    const [delivery] = notification.deliveries;
    if (!delivery) {
      throw new Error("Test fixture is invalid");
    }

    await expect(adapter.send(notification, delivery)).rejects.toThrow("503");
  });
});
