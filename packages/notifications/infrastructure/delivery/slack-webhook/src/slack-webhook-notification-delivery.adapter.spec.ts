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

    await expect(
      adapter.send({
        id: "delivery-1",
        notificationId: "notification-1",
        channel: "slack",
        destination: "security",
        title: "Alert",
        message: "Suspicious activity",
        attempts: 0,
      }),
    ).rejects.toThrow("503");
  });
});
