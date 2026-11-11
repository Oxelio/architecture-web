import { type Kysely, sql } from "kysely";

import type { NotificationDatabase } from "./schema.js";

async function up(db: Kysely<NotificationDatabase>): Promise<void> {
  await db.schema
    .createTable("notification_consumptions")
    .addColumn("source_event_id", "uuid", (column) => column.primaryKey())
    .addColumn("consumed_at", "timestamptz", (column) =>
      column.defaultTo(sql`clock_timestamp()`).notNull(),
    )
    .execute();
  await db.schema
    .createTable("notifications")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("recipient_id", "uuid", (column) => column.notNull())
    .addColumn("source_event_id", "uuid", (column) => column.notNull())
    .addColumn("type", "varchar(160)", (column) => column.notNull())
    .addColumn("severity", "varchar(24)", (column) => column.notNull())
    .addColumn("title", "varchar(200)", (column) => column.notNull())
    .addColumn("message", "text", (column) => column.notNull())
    .addColumn("action", "varchar(512)")
    .addColumn("created_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("read_at", "timestamptz")
    .addColumn("archived_at", "timestamptz")
    .addUniqueConstraint("notifications_source_recipient_unique", [
      "recipient_id",
      "source_event_id",
    ])
    .execute();
  await db.schema
    .createIndex("notifications_recipient_idx")
    .on("notifications")
    .columns(["recipient_id", "created_at"])
    .execute();

  await db.schema
    .createTable("notification_deliveries")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("notification_id", "uuid", (column) =>
      column.references("notifications.id").onDelete("cascade").notNull(),
    )
    .addColumn("channel", "varchar(24)", (column) => column.notNull())
    .addColumn("destination", "varchar(512)", (column) => column.notNull())
    .addColumn("audience", "varchar(40)", (column) => column.notNull())
    .addColumn("suppression_reason", "varchar(80)")
    .addColumn("status", "varchar(24)", (column) => column.notNull())
    .addColumn("attempts", "integer", (column) => column.defaultTo(0).notNull())
    .addColumn("available_at", "timestamptz", (column) => column.notNull())
    .addColumn("claimed_at", "timestamptz")
    .addColumn("claim_token", "uuid")
    .addColumn("sent_at", "timestamptz")
    .addColumn("last_error", "text")
    .addUniqueConstraint("notification_delivery_unique", [
      "notification_id",
      "channel",
      "destination",
    ])
    .execute();
  await db.schema
    .createIndex("notification_delivery_pending_idx")
    .on("notification_deliveries")
    .columns(["status", "available_at"])
    .execute();

  await db.schema
    .createTable("notification_preferences")
    .addColumn("user_id", "uuid", (column) => column.notNull())
    .addColumn("channel", "varchar(24)", (column) => column.notNull())
    .addColumn("enabled", "boolean", (column) =>
      column.defaultTo(true).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .addPrimaryKeyConstraint("notification_preferences_pk", [
      "user_id",
      "channel",
    ])
    .execute();
}

async function down(db: Kysely<NotificationDatabase>): Promise<void> {
  for (const table of [
    "notification_preferences",
    "notification_deliveries",
    "notifications",
    "notification_consumptions",
  ] as const) {
    await db.schema.dropTable(table).ifExists().cascade().execute();
  }
}

export const notificationMigrations = {
  "007_create_notifications": { up, down },
  "010_add_notification_attempt_eligibility": {
    async up(db: Kysely<NotificationDatabase>): Promise<void> {
      await db.schema
        .alterTable("notification_deliveries")
        .alterColumn("destination", (column) => column.dropNotNull())
        .addColumn("unresolved_eligibility_checks", "integer", (column) =>
          column.defaultTo(0).notNull(),
        )
        .addColumn("processing_phase", "varchar(24)")
        .addColumn("last_provider_outcome", "varchar(16)")
        .execute();
      await db
        .updateTable("notification_deliveries")
        .set({ processing_phase: "provider_admitted" })
        .where("status", "=", "processing")
        .where("audience", "!=", "administrator")
        .execute();
      await db.schema
        .alterTable("notification_deliveries")
        .addCheckConstraint(
          "notification_delivery_sendable_destination",
          sql`status in ('sent', 'dead_letter', 'suppressed')
            or (destination is not null and btrim(destination) <> '')`,
        )
        .execute();
      await db.schema
        .alterTable("notification_deliveries")
        .addCheckConstraint(
          "notification_delivery_eligibility_budget",
          sql`unresolved_eligibility_checks between 0 and 10`,
        )
        .execute();
    },
  },
};
