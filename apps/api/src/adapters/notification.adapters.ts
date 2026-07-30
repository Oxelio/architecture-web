import type {
  NotificationDelivery,
  NotificationRecipient,
  PendingDelivery,
} from "@architecture/notifications";
import { NotificationRecipientDirectory } from "@architecture/notifications";
import type { Kysely } from "kysely";

import type { AppDatabase } from "#composition-root/database.module";

export class KyselyNotificationRecipientDirectory extends NotificationRecipientDirectory {
  constructor(private readonly db: Kysely<AppDatabase>) {
    super();
  }

  async findUser(userId: string): Promise<NotificationRecipient | null> {
    const row = await this.db
      .selectFrom("iam_users")
      .select(["id", "email"])
      .where("id", "=", userId)
      .executeTakeFirst();
    return row ? { userId: row.id, email: row.email } : null;
  }

  async listAdministratorIds(): Promise<string[]> {
    const rows = await this.db
      .selectFrom("iam_users")
      .select("id")
      .where("role", "=", "admin")
      .where("status", "=", "active")
      .execute();
    return rows.map((row) => row.id);
  }
}

export class SlackWebhookNotificationAdapter implements NotificationDelivery {
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

export class SmsWebhookNotificationAdapter implements NotificationDelivery {
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
