import type {
  NotificationDelivery,
  PendingDelivery,
} from "@architecture/notifications/application";

export class SlackWebhookNotificationDeliveryAdapter implements NotificationDelivery {
  readonly channel = "slack" as const;

  constructor(private readonly webhookUrl: string) {}

  async send(delivery: PendingDelivery): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `*${delivery.title}*\n${delivery.message}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Slack delivery failed with ${response.status}`);
    }
  }
}
