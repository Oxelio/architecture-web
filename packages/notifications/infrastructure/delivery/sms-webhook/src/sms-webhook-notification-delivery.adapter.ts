import type {
  NotificationDelivery,
  PendingDelivery,
} from "@architecture/notifications/application";

export class SmsWebhookNotificationDeliveryAdapter implements NotificationDelivery {
  readonly channel = "sms" as const;

  constructor(private readonly webhookUrl: string) {}

  async send(delivery: PendingDelivery): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: delivery.destination,
        message: `${delivery.title}: ${delivery.message}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`SMS delivery failed with ${response.status}`);
    }
  }
}
