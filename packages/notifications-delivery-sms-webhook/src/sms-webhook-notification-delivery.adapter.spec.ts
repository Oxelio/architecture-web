import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

import { SmsWebhookNotificationDeliveryAdapter } from "./sms-webhook-notification-delivery.adapter.js";

describe("SmsWebhookNotificationDeliveryAdapter", () => {
  it("sends the destination and notification text to the webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new SmsWebhookNotificationDeliveryAdapter(
      "https://example.test/sms",
    );
    const severity = NotificationSeverityValueObject.create("warning");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const notification = NotificationEntity.create({
      recipientId: "user-1",
      sourceEventId: "event-1",
      type: "iam.session-started",
      severity: severity.value,
      title: "Security alert",
      message: "A new session was opened.",
      deliveries: [{ channel: "sms", destination: "+33123456789" }],
    });
    const [delivery] = notification.deliveries;
    if (!delivery) {
      throw new Error("Test fixture is invalid");
    }

    await adapter.send(notification, delivery);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/sms",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          to: "+33123456789",
          message: "Security alert: A new session was opened.",
        }),
      }),
    );
  });
});
