import { NotificationDelivery } from "@architecture/notifications/application";
import type {
  NotificationDeliveryEntity,
  NotificationEntity,
} from "@architecture/notifications/domain";

export class SmsWebhookNotificationDeliveryAdapter extends NotificationDelivery {
  readonly channel = "sms" as const;

  constructor(private readonly webhookUrl: string) {
    super();
  }

  async send(
    notification: NotificationEntity,
    delivery: NotificationDeliveryEntity,
  ): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: delivery.destination,
        message: `${notification.title}: ${notification.message}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`SMS delivery failed with ${response.status}`);
    }
  }
}
