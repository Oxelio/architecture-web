import {
  type NotificationPreference,
  NotificationRepository,
  type NotificationView,
  type PendingDelivery,
} from "@architecture/notifications/application";
import type {
  NotificationChannelType,
  NotificationEntity,
} from "@architecture/notifications/domain";
import type { Kysely } from "kysely";

import { notificationRowToEntity } from "./notification.mapper.js";
import type { NotificationDatabase } from "./schema.js";

export class KyselyNotificationRepositoryAdapter extends NotificationRepository {
  constructor(private readonly db: Kysely<NotificationDatabase>) {
    super();
  }

  async create(notification: NotificationEntity): Promise<void> {
    await this.db.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("notifications")
        .values({
          id: notification.identifier.value,
          recipient_id: notification.recipientId,
          source_event_id: notification.sourceEventId,
          type: notification.type,
          severity: notification.severity.value,
          title: notification.title,
          message: notification.message,
          action_url: notification.actionUrl,
          created_at: notification.createdAt,
          read_at: notification.readAt,
          archived_at: notification.archivedAt,
        } as never)
        .onConflict((conflict) =>
          conflict.columns(["recipient_id", "source_event_id"]).doNothing(),
        )
        .execute();
      const row = await transaction
        .selectFrom("notifications")
        .select("id")
        .where("recipient_id", "=", notification.recipientId)
        .where("source_event_id", "=", notification.sourceEventId)
        .executeTakeFirstOrThrow();
      for (const delivery of notification.deliveries) {
        await transaction
          .insertInto("notification_deliveries")
          .values({
            id: delivery.identifier.value,
            notification_id: row.id,
            channel: delivery.channel.value,
            destination: delivery.destination,
            status: delivery.status,
            attempts: delivery.attempts,
            available_at: delivery.availableAt,
            claimed_at: delivery.claimedAt,
            sent_at: delivery.sentAt,
            last_error: delivery.lastError,
          } as never)
          .onConflict((conflict) =>
            conflict
              .columns(["notification_id", "channel", "destination"])
              .doNothing(),
          )
          .execute();
      }
    });
  }

  async findByIdForRecipient(
    notificationId: string,
    recipientId: string,
  ): Promise<NotificationEntity | null> {
    const row = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("id", "=", notificationId)
      .where("recipient_id", "=", recipientId)
      .where("archived_at", "is", null)
      .executeTakeFirst();
    return row ? notificationRowToEntity(row) : null;
  }

  async save(notification: NotificationEntity): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set({
        read_at: notification.readAt,
        archived_at: notification.archivedAt,
      })
      .where("id", "=", notification.identifier.value)
      .where("recipient_id", "=", notification.recipientId)
      .execute();
  }

  async list(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationView[]> {
    const size = Math.min(100, Math.max(1, pageSize));
    const rows = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("recipient_id", "=", recipientId)
      .where("archived_at", "is", null)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(size)
      .offset((Math.max(1, page) - 1) * size)
      .execute();
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      actionUrl: row.action_url,
      createdAt: row.created_at,
      readAt: row.read_at,
    }));
  }

  async unreadCount(recipientId: string): Promise<number> {
    const row = await this.db
      .selectFrom("notifications")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("recipient_id", "=", recipientId)
      .where("read_at", "is", null)
      .where("archived_at", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async markAllRead(recipientId: string): Promise<void> {
    await this.db
      .updateTable("notifications")
      .set({ read_at: new Date() })
      .where("recipient_id", "=", recipientId)
      .where("read_at", "is", null)
      .execute();
  }

  async preferences(recipientId: string): Promise<NotificationPreference[]> {
    return this.db
      .selectFrom("notification_preferences")
      .select(["channel", "enabled"])
      .where("user_id", "=", recipientId)
      .execute();
  }

  async setPreference(
    recipientId: string,
    channel: NotificationChannelType,
    enabled: boolean,
  ): Promise<void> {
    await this.db
      .insertInto("notification_preferences")
      .values({
        user_id: recipientId,
        channel,
        enabled,
        updated_at: new Date(),
      } as never)
      .onConflict((conflict) =>
        conflict.columns(["user_id", "channel"]).doUpdateSet({
          enabled,
          updated_at: new Date(),
        }),
      )
      .execute();
  }

  async isChannelEnabled(
    recipientId: string,
    channel: NotificationChannelType,
  ): Promise<boolean> {
    const row = await this.db
      .selectFrom("notification_preferences")
      .select("enabled")
      .where("user_id", "=", recipientId)
      .where("channel", "=", channel)
      .executeTakeFirst();
    return row?.enabled ?? true;
  }

  async claimDeliveries(limit: number): Promise<PendingDelivery[]> {
    return this.db.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("notification_deliveries")
        .set({
          status: "failed",
          claimed_at: null,
          available_at: new Date(),
        })
        .where("status", "=", "processing")
        .where("claimed_at", "<", new Date(Date.now() - 5 * 60_000))
        .execute();
      const rows = await transaction
        .selectFrom("notification_deliveries")
        .innerJoin(
          "notifications",
          "notifications.id",
          "notification_deliveries.notification_id",
        )
        .select([
          "notification_deliveries.id",
          "notification_deliveries.notification_id",
          "notification_deliveries.channel",
          "notification_deliveries.destination",
          "notification_deliveries.attempts",
          "notifications.title",
          "notifications.message",
        ])
        .where("notification_deliveries.status", "in", ["pending", "failed"])
        .where("notification_deliveries.available_at", "<=", new Date())
        .orderBy("notification_deliveries.available_at", "asc")
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();
      if (rows.length > 0) {
        await transaction
          .updateTable("notification_deliveries")
          .set({ status: "processing", claimed_at: new Date() })
          .where(
            "id",
            "in",
            rows.map((row) => row.id),
          )
          .execute();
      }
      return rows.map((row) => ({
        id: row.id,
        notificationId: row.notification_id,
        channel: row.channel,
        destination: row.destination,
        title: row.title,
        message: row.message,
        attempts: row.attempts,
      }));
    });
  }

  async deliverySucceeded(id: string): Promise<void> {
    await this.db
      .updateTable("notification_deliveries")
      .set({
        status: "sent",
        sent_at: new Date(),
        claimed_at: null,
        last_error: null,
      })
      .where("id", "=", id)
      .execute();
  }

  async deliveryFailed(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const delay = Math.min(60_000, 2 ** Math.min(attempts, 10) * 1_000);
    await this.db
      .updateTable("notification_deliveries")
      .set({
        status: attempts >= 10 ? "dead_letter" : "failed",
        attempts,
        available_at: new Date(Date.now() + delay),
        claimed_at: null,
        last_error: String(error).slice(0, 2_000),
      })
      .where("id", "=", id)
      .execute();
  }
}
