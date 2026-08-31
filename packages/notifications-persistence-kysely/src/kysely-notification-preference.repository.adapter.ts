import { NotificationPreferenceRepository } from "@architecture/notifications/application";
import type {
  NotificationChannelType,
  NotificationPreferenceEntity,
} from "@architecture/notifications/domain";
import type { Kysely } from "kysely";

import { notificationPreferenceRowToEntity } from "./notification.mapper.js";
import type { NotificationDatabase } from "./schema.js";

export class KyselyNotificationPreferenceRepositoryAdapter extends NotificationPreferenceRepository {
  constructor(private readonly db: Kysely<NotificationDatabase>) {
    super();
  }

  async listForRecipient(
    recipientId: string,
  ): Promise<NotificationPreferenceEntity[]> {
    const rows = await this.db
      .selectFrom("notification_preferences")
      .selectAll()
      .where("user_id", "=", recipientId)
      .execute();
    return rows.map(notificationPreferenceRowToEntity);
  }

  async find(
    recipientId: string,
    channel: NotificationChannelType,
  ): Promise<NotificationPreferenceEntity | null> {
    const row = await this.db
      .selectFrom("notification_preferences")
      .selectAll()
      .where("user_id", "=", recipientId)
      .where("channel", "=", channel)
      .executeTakeFirst();
    return row ? notificationPreferenceRowToEntity(row) : null;
  }

  async save(preference: NotificationPreferenceEntity): Promise<void> {
    await this.db
      .insertInto("notification_preferences")
      .values({
        user_id: preference.recipientId,
        channel: preference.channel.value,
        enabled: preference.enabled,
        updated_at: preference.updatedAt,
      } as never)
      .onConflict((conflict) =>
        conflict.columns(["user_id", "channel"]).doUpdateSet({
          enabled: preference.enabled,
          updated_at: preference.updatedAt,
        }),
      )
      .execute();
  }
}
