import { describe, expect, it, vi } from "vitest";

import { SmsWebhookNotificationDeliveryAdapter } from "./sms-webhook-notification-delivery.adapter.js";

describe("SmsWebhookNotificationDeliveryAdapter", () => {
  it("sends the destination and notification text to the webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new SmsWebhookNotificationDeliveryAdapter(
      "https://example.test/sms",
    );

    await adapter.send({
      id: "delivery-1",
      notificationId: "notification-1",
      channel: "sms",
      destination: "+33123456789",
      title: "Security alert",
      message: "A new session was opened.",
      attempts: 0,
    });

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
