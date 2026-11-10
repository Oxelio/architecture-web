import { randomUUID } from "node:crypto";

import {
  type AffectedUserDeliveryEligibility,
  type ClaimedNotificationDelivery,
  type DeliveryEligibilityClaim,
  NotificationRepository,
} from "@architecture/notifications/application";
import type { NotificationEntity } from "@architecture/notifications/domain";
import { type Kysely, sql } from "kysely";

import {
  claimableNotificationRowToEntity,
  notificationRowToEntity,
} from "./notification.mapper.js";
import type { NotificationDatabase } from "./schema.js";

const ATTEMPT_LIMIT = 10;
const ELIGIBILITY_CHECK_LIMIT = 10;
const leaseCutoff = sql<Date>`clock_timestamp() - interval '5 minutes'`;

function retryAt(count: number | ReturnType<typeof sql<number>>) {
  return sql<Date>`clock_timestamp() + least(60, power(2, least(${count}, 10))) * interval '1 second'`;
}

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
    const affected = delivery.audience !== "administrator";
    const lastError =
      delivery.status === "failed" || delivery.status === "dead_letter"
        ? delivery.lastError === "delivery_adapter_unavailable" ||
          delivery.lastError === "administrator_eligibility_unavailable"
          ? delivery.lastError
          : "provider_outcome_unknown"
        : null;
    const result = await this.db
      .updateTable("notification_deliveries")
      .set({
        status: delivery.status,
        suppression_reason: delivery.suppressionReason,
        attempts: delivery.attempts,
        available_at: retryAt(delivery.attempts),
        claimed_at: null,
        claim_token: null,
        processing_phase: null,
        sent_at:
          delivery.status === "sent" ? sql<Date>`clock_timestamp()` : null,
        last_error: lastError,
        ...(affected &&
          (delivery.status === "sent" ||
            delivery.status === "dead_letter" ||
            delivery.status === "suppressed") && { destination: null }),
        ...(delivery.status === "sent" && { last_provider_outcome: "sent" }),
        ...(lastError === "provider_outcome_unknown" && {
          last_provider_outcome: "unknown",
        }),
      })
      .where("id", "=", delivery.identifier.value)
      .where("notification_id", "=", notification.identifier.value)
      .where("status", "=", "processing")
      .where("claim_token", "=", claimToken)
      .where("claimed_at", ">", leaseCutoff)
      .$if(affected, (query) =>
        query.where("processing_phase", "=", "provider_admitted"),
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
        status: sql`case when unresolved_eligibility_checks >= ${ELIGIBILITY_CHECK_LIMIT}
          then 'suppressed' else 'failed' end`,
        suppression_reason: sql`case when unresolved_eligibility_checks >= ${ELIGIBILITY_CHECK_LIMIT}
          then 'eligibility_unverified' end`,
        destination: sql`case when unresolved_eligibility_checks < ${ELIGIBILITY_CHECK_LIMIT}
          then destination end`,
        claimed_at: null,
        claim_token: null,
        processing_phase: null,
        available_at: retryAt(sql<number>`unresolved_eligibility_checks`),
        last_error: "eligibility_check_abandoned",
      })
      .where("status", "=", "processing")
      .where("processing_phase", "=", "checking_eligibility")
      .where("claimed_at", "<=", leaseCutoff)
      .execute();
    await this.db
      .updateTable("notification_deliveries")
      .set({
        status: sql`case when attempts >= ${ATTEMPT_LIMIT} then 'dead_letter' else 'failed' end`,
        destination: sql`case when attempts < ${ATTEMPT_LIMIT}
          or audience = 'administrator' then destination end`,
        claimed_at: null,
        claim_token: null,
        processing_phase: null,
        available_at: retryAt(sql<number>`attempts`),
        last_error: "provider_outcome_unknown",
        last_provider_outcome: "unknown",
      })
      .where("status", "=", "processing")
      .where(({ or, eb }) =>
        or([
          eb("processing_phase", "=", "provider_admitted"),
          eb("audience", "=", "administrator"),
        ]),
      )
      .where("claimed_at", "<=", leaseCutoff)
      .execute();
  }

  async claimDelivery(): Promise<
    ClaimedNotificationDelivery | DeliveryEligibilityClaim | null
  > {
    return this.db.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom("notification_deliveries")
        .innerJoin(
          "notifications",
          "notifications.id",
          "notification_deliveries.notification_id",
        )
        .select([
          "notifications.recipient_id",
          "notification_deliveries.id as delivery_id",
          "notification_deliveries.audience",
          "notification_deliveries.attempts",
          "notification_deliveries.unresolved_eligibility_checks",
        ])
        .where("notification_deliveries.status", "in", ["pending", "failed"])
        .where(
          "notification_deliveries.available_at",
          "<=",
          sql<Date>`clock_timestamp()`,
        )
        .where("notification_deliveries.attempts", "<", ATTEMPT_LIMIT)
        .where(
          "notification_deliveries.unresolved_eligibility_checks",
          "<",
          ELIGIBILITY_CHECK_LIMIT,
        )
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
      const affected = row.audience !== "administrator";
      await transaction
        .updateTable("notification_deliveries")
        .set({
          status: "processing",
          claimed_at: sql<Date>`clock_timestamp()`,
          claim_token: claimToken,
          ...(affected
            ? {
                processing_phase: "checking_eligibility",
                unresolved_eligibility_checks:
                  row.unresolved_eligibility_checks + 1,
              }
            : { attempts: row.attempts + 1 }),
        })
        .where("id", "=", row.delivery_id)
        .execute();
      if (affected) {
        return {
          deliveryId: row.delivery_id,
          recipientId: row.recipient_id,
          claimToken,
        };
      }
      return this.loadSendSnapshot(transaction, row.delivery_id, claimToken);
    });
  }

  async resolveDeliveryEligibility(
    claim: DeliveryEligibilityClaim,
    eligibility: AffectedUserDeliveryEligibility,
    dataUseDeadline?: Date,
  ): Promise<ClaimedNotificationDelivery | null> {
    return this.db.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom("notification_deliveries")
        .select(["attempts", "unresolved_eligibility_checks"])
        .$if(dataUseDeadline !== undefined, (query) =>
          query.select(
            sql<boolean>`clock_timestamp() >= ${dataUseDeadline}`.as(
              "authorization_expired",
            ),
          ),
        )
        .where("id", "=", claim.deliveryId)
        .where("status", "=", "processing")
        .where("processing_phase", "=", "checking_eligibility")
        .where("claim_token", "=", claim.claimToken)
        .where("claimed_at", ">", leaseCutoff)
        .forUpdate()
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      const unresolved = eligibility === "unresolved";
      const checks = row.unresolved_eligibility_checks - (unresolved ? 0 : 1);
      const reason =
        eligibility === "erased"
          ? "account_erased"
          : unresolved
            ? checks >= ELIGIBILITY_CHECK_LIMIT
              ? "eligibility_unverified"
              : null
            : row.authorization_expired
              ? "authorization_expired"
              : null;
      const update = transaction
        .updateTable("notification_deliveries")
        .where("id", "=", claim.deliveryId);
      if (reason || unresolved) {
        await update
          .set({
            status: reason ? "suppressed" : "failed",
            suppression_reason: reason,
            ...(reason && { destination: null }),
            unresolved_eligibility_checks: checks,
            claimed_at: null,
            claim_token: null,
            processing_phase: null,
            available_at: retryAt(checks),
            last_error: null,
          })
          .execute();
        return null;
      }
      await update
        .set({
          processing_phase: "provider_admitted",
          unresolved_eligibility_checks: checks,
          attempts: row.attempts + 1,
        })
        .execute();
      return this.loadSendSnapshot(
        transaction,
        claim.deliveryId,
        claim.claimToken,
      );
    });
  }

  async ownsAuthorizedDelivery(
    claim: ClaimedNotificationDelivery,
  ): Promise<boolean> {
    const row = await this.db
      .selectFrom("notification_deliveries")
      .select("id")
      .where("id", "=", claim.delivery.identifier.value)
      .where("status", "=", "processing")
      .where("processing_phase", "=", "provider_admitted")
      .where("claim_token", "=", claim.claimToken)
      .where("claimed_at", ">", leaseCutoff)
      .executeTakeFirst();
    return row !== undefined;
  }

  async expireDeliveryAuthorization(
    claim: ClaimedNotificationDelivery,
  ): Promise<void> {
    await this.db
      .updateTable("notification_deliveries")
      .set({
        status: "suppressed",
        suppression_reason: "authorization_expired",
        attempts: sql<number>`attempts - 1`,
        destination: null,
        claimed_at: null,
        claim_token: null,
        processing_phase: null,
        last_error: null,
      })
      .where("id", "=", claim.delivery.identifier.value)
      .where("status", "=", "processing")
      .where("processing_phase", "=", "provider_admitted")
      .where("claim_token", "=", claim.claimToken)
      .where("claimed_at", ">", leaseCutoff)
      .execute();
  }

  private async loadSendSnapshot(
    transaction: Kysely<NotificationDatabase>,
    deliveryId: string,
    claimToken: string,
  ): Promise<ClaimedNotificationDelivery> {
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
      ])
      .where("notification_deliveries.id", "=", deliveryId)
      .executeTakeFirstOrThrow();
    const notification = claimableNotificationRowToEntity({
      ...row,
      last_error: null,
    });
    const delivery = notification.deliveries[0];
    if (!delivery) {
      throw new Error("Missing claimed delivery");
    }
    return { notification, delivery, claimToken };
  }
}
