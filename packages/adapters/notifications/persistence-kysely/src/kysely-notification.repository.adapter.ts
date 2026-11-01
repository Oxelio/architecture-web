import { randomUUID } from "node:crypto";

import {
  type ClaimedNotificationDelivery,
  NotificationRepository,
} from "@architecture/notifications/application";
import type { NotificationEntity } from "@architecture/notifications/domain";
import { type Kysely, sql } from "kysely";

import {
  claimableNotificationRowToEntity,
  notificationRowToEntity,
} from "./notification.mapper.js";
import type { NotificationDatabase } from "./schema.js";

export class KyselyNotificationRepositoryAdapter extends NotificationRepository {
  constructor(private readonly db: Kysely<NotificationDatabase>) {
    super();
  }

  async hasConsumedEvent(sourceEventId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom("notification_consumptions")
      .select("source_event_id")
      .where("source_event_id", "=", sourceEventId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async createForEvent(
    sourceEventId: string,
    notifications: readonly NotificationEntity[],
  ): Promise<void> {
    if (
      notifications.some(
        (notification) => notification.sourceEventId !== sourceEventId,
      )
    ) {
      throw new Error("Notification snapshot must belong to its source event");
    }
    await this.db.transaction().execute(async (transaction) => {
      const consumption = await transaction
        .insertInto("notification_consumptions")
        .values({
          source_event_id: sourceEventId,
          consumed_at: sql<Date>`clock_timestamp()`,
        })
        .onConflict((conflict) =>
          conflict.column("source_event_id").doNothing(),
        )
        .returning("source_event_id")
        .executeTakeFirst();
      if (!consumption) {
        return;
      }
      for (const notification of notifications) {
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
            action: notification.action,
            created_at: notification.createdAt,
            read_at: notification.readAt,
            archived_at: notification.archivedAt,
          })
          .execute();
        for (const delivery of notification.deliveries) {
          await transaction
            .insertInto("notification_deliveries")
            .values({
              id: delivery.identifier.value,
              notification_id: notification.identifier.value,
              channel: delivery.channel.value,
              destination: delivery.destination,
              audience: delivery.audience,
              suppression_reason: delivery.suppressionReason,
              status: delivery.status,
              attempts: delivery.attempts,
              available_at: delivery.availableAt,
              claimed_at: delivery.claimedAt,
              claim_token: null,
              sent_at: delivery.sentAt,
              last_error: delivery.lastError,
            })
            .execute();
        }
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

  async saveState(notification: NotificationEntity): Promise<void> {
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

  async finalizeDelivery({
    notification,
    delivery,
    claimToken,
  }: ClaimedNotificationDelivery): Promise<boolean> {
    if (
      !["sent", "failed", "dead_letter", "suppressed"].includes(delivery.status)
    ) {
      throw new Error("Only a completed delivery attempt can be finalized");
    }
    const result = await this.db
      .updateTable("notification_deliveries")
      .set({
        status: delivery.status,
        suppression_reason: delivery.suppressionReason,
        attempts: delivery.attempts,
        available_at: sql<Date>`clock_timestamp() + least(60, power(2, least(${delivery.attempts}, 10))) * interval '1 second'`,
        claimed_at: null,
        claim_token: null,
        sent_at:
          delivery.status === "sent" ? sql<Date>`clock_timestamp()` : null,
        last_error: delivery.lastError,
      })
      .where("id", "=", delivery.identifier.value)
      .where("notification_id", "=", notification.identifier.value)
      .where("status", "=", "processing")
      .where("claim_token", "=", claimToken)
      .where(
        "claimed_at",
        ">",
        sql<Date>`clock_timestamp() - interval '5 minutes'`,
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
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

  async recoverStaleDeliveries(): Promise<void> {
    await this.db
      .updateTable("notification_deliveries")
      .set({
        status: sql`case when attempts >= 10 then 'dead_letter' else 'failed' end`,
        claimed_at: null,
        claim_token: null,
        available_at: sql<Date>`clock_timestamp() + least(60, power(2, least(attempts, 10))) * interval '1 second'`,
        last_error: "Processing claim expired",
      })
      .where("status", "=", "processing")
      .where(
        "claimed_at",
        "<=",
        sql<Date>`clock_timestamp() - interval '5 minutes'`,
      )
      .execute();
  }

  async claimDelivery(): Promise<ClaimedNotificationDelivery | null> {
    return this.db.transaction().execute(async (transaction) => {
      const row = await transaction
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
          "notifications.action",
          "notifications.created_at",
          "notifications.read_at",
          "notifications.archived_at",
          "notification_deliveries.id as delivery_id",
          "notification_deliveries.channel",
          "notification_deliveries.destination",
          "notification_deliveries.audience",
          "notification_deliveries.suppression_reason",
          "notification_deliveries.status",
          "notification_deliveries.attempts",
          "notification_deliveries.available_at",
          "notification_deliveries.claimed_at",
          "notification_deliveries.sent_at",
          "notification_deliveries.last_error",
        ])
        .where("notification_deliveries.status", "in", ["pending", "failed"])
        .where(
          "notification_deliveries.available_at",
          "<=",
          sql<Date>`clock_timestamp()`,
        )
        .where("notification_deliveries.attempts", "<", 10)
        .orderBy("notification_deliveries.available_at", "asc")
        .orderBy("notification_deliveries.id", "asc")
        .limit(1)
        .forUpdate("notification_deliveries")
        .skipLocked()
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      const claimToken = randomUUID();
      const claimed = await transaction
        .updateTable("notification_deliveries")
        .set({
          status: "processing",
          claimed_at: sql<Date>`clock_timestamp()`,
          claim_token: claimToken,
          attempts: row.attempts + 1,
        })
        .where("id", "=", row.delivery_id)
        .returning(["claimed_at", "attempts"])
        .executeTakeFirstOrThrow();
      const notification = claimableNotificationRowToEntity({
        ...row,
        ...claimed,
        status: "processing",
      });
      const delivery = notification.deliveries[0];
      if (!delivery) {
        throw new Error("Missing claimed delivery");
      }
      return { notification, delivery, claimToken };
    });
  }
}
