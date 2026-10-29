import { type Kysely, sql } from "kysely";

import type { AuditDatabase } from "./schema.js";

async function up(db: Kysely<AuditDatabase>): Promise<void> {
  await db.schema
    .createTable("audit_events")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("type", "varchar(160)", (column) => column.notNull())
    .addColumn("occurred_at", "timestamptz", (column) => column.notNull())
    .addColumn("result", "varchar(24)", (column) => column.notNull())
    .addColumn("actor_type", "varchar(24)", (column) => column.notNull())
    .addColumn("actor_id", "uuid")
    .addColumn("subject_id", "uuid")
    .addColumn("correlation_id", "varchar(128)")
    .addColumn("network_fingerprint", "varchar(64)")
    .addColumn("client", "varchar(256)")
    .addColumn("metadata", "jsonb", (column) =>
      column.defaultTo(sql`'{}'::jsonb`).notNull(),
    )
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("legal_hold", "boolean", (column) =>
      column.defaultTo(false).notNull(),
    )
    .execute();
  await db.schema
    .createIndex("audit_events_subject_idx")
    .on("audit_events")
    .columns(["subject_id", "occurred_at"])
    .execute();
}

async function down(db: Kysely<AuditDatabase>): Promise<void> {
  await db.schema.dropTable("audit_events").ifExists().cascade().execute();
}

export const auditMigrations = {
  "006_create_audit": { up, down },
};
