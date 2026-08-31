import { type Kysely, sql } from "kysely";

import type { MessagingDatabase } from "./schema.js";

async function up(db: Kysely<MessagingDatabase>): Promise<void> {
  await db.schema
    .createTable("messaging_outbox")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("topic", "varchar(160)", (column) => column.notNull())
    .addColumn("version", "integer", (column) => column.notNull())
    .addColumn("aggregate_id", "varchar(128)", (column) => column.notNull())
    .addColumn("occurred_at", "timestamptz", (column) => column.notNull())
    .addColumn("payload", "jsonb", (column) => column.notNull())
    .addColumn("context", "jsonb", (column) =>
      column.defaultTo(sql`'{}'::jsonb`).notNull(),
    )
    .addColumn("status", "varchar(24)", (column) => column.notNull())
    .addColumn("attempts", "integer", (column) => column.defaultTo(0).notNull())
    .addColumn("available_at", "timestamptz", (column) => column.notNull())
    .addColumn("claimed_at", "timestamptz")
    .addColumn("published_at", "timestamptz")
    .addColumn("last_error", "text")
    .execute();
  await db.schema
    .createIndex("messaging_outbox_pending_idx")
    .on("messaging_outbox")
    .columns(["status", "available_at"])
    .execute();
}

async function down(db: Kysely<MessagingDatabase>): Promise<void> {
  await db.schema.dropTable("messaging_outbox").ifExists().cascade().execute();
}

export const messagingMigrations = {
  "005_create_messaging_outbox": { up, down },
};
