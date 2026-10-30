import { NotificationDelivery } from "@architecture/notifications/application";
import type {
  NotificationDeliveryEntity,
  NotificationEntity,
} from "@architecture/notifications/domain";

export class SlackWebhookNotificationDeliveryAdapter extends NotificationDelivery {
  readonly channel = "slack" as const;

  constructor(private readonly webhookUrl: string) {
    super();
  }

  async send(
    notification: NotificationEntity,
    _delivery: NotificationDeliveryEntity,
  ): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `*${notification.title}*\n${notification.message}`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Slack delivery failed with ${response.status}`);
    }
  }
}
