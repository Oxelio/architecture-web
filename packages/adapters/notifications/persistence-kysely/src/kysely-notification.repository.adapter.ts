import { NotificationRepository } from "@architecture/notifications/application";
import type { NotificationEntity } from "@architecture/notifications/domain";
import type { Kysely } from "kysely";

import {
  claimableNotificationRowsToEntities,
  notificationRowToEntity,
} from "./notification.mapper.js";
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
    await this.db.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("notifications")
        .set({
          read_at: notification.readAt,
          archived_at: notification.archivedAt,
        })
        .where("id", "=", notification.identifier.value)
        .where("recipient_id", "=", notification.recipientId)
        .execute();
      for (const delivery of notification.deliveries) {
        await transaction
          .updateTable("notification_deliveries")
          .set({
            status: delivery.status,
            attempts: delivery.attempts,
            available_at: delivery.availableAt,
            claimed_at: delivery.claimedAt,
            sent_at: delivery.sentAt,
            last_error: delivery.lastError,
          })
          .where("id", "=", delivery.identifier.value)
          .where("notification_id", "=", notification.identifier.value)
          .execute();
      }
    });
  }

  async list(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationEntity[]> {
    const rows = await this.db
      .selectFrom("notifications")
      .selectAll()
      .where("recipient_id", "=", recipientId)
      .where("archived_at", "is", null)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();
    return rows.map(notificationRowToEntity);
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

  async claimDeliveries(limit: number): Promise<NotificationEntity[]> {
    return this.db.transaction().execute(async (transaction) => {
      const now = new Date();
      await transaction
        .updateTable("notification_deliveries")
        .set({
          status: "failed",
          claimed_at: null,
          available_at: now,
        })
        .where("status", "=", "processing")
        .where("claimed_at", "<", new Date(now.getTime() - 5 * 60_000))
        .execute();
      const rows = await transaction
        .selectFrom("notification_deliveries")
        .innerJoin(
          "notifications",
          "notifications.id",
          "notification_deliveries.notification_id",
        )
        .select([
          "notifications.id as notification_id",
          "notifications.recipient_id",
          "notifications.source_event_id",
          "notifications.type",
          "notifications.severity",
          "notifications.title",
          "notifications.message",
          "notifications.action_url",
          "notifications.created_at",
          "notifications.read_at",
          "notifications.archived_at",
          "notification_deliveries.id as delivery_id",
          "notification_deliveries.channel",
          "notification_deliveries.destination",
          "notification_deliveries.status",
          "notification_deliveries.attempts",
          "notification_deliveries.available_at",
          "notification_deliveries.claimed_at",
          "notification_deliveries.sent_at",
          "notification_deliveries.last_error",
        ])
        .where("notification_deliveries.status", "in", ["pending", "failed"])
        .where("notification_deliveries.available_at", "<=", now)
        .orderBy("notification_deliveries.available_at", "asc")
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();
      const notifications = claimableNotificationRowsToEntities(rows);
      const deliveries = notifications.flatMap(
        (notification) => notification.deliveries,
      );
      for (const delivery of deliveries) {
        if (!delivery.claim(now)) {
          throw new Error("A selected notification delivery cannot be claimed");
        }
      }
      if (deliveries.length > 0) {
        await transaction
          .updateTable("notification_deliveries")
          .set({ status: "processing", claimed_at: now })
          .where(
            "id",
            "in",
            deliveries.map((delivery) => delivery.identifier.value),
          )
          .execute();
      }
      return notifications;
    });
  }
}
