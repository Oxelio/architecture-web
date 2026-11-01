import { type Kysely, sql } from "kysely";

import type { AuditDatabase } from "./schema.js";

async function up(db: Kysely<AuditDatabase>): Promise<void> {
  await db.schema
    .createTable("audit_deleted_subjects")
    .addColumn("reference", "varchar(64)", (column) => column.primaryKey())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .execute();
  await db.schema
    .createTable("audit_events")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("type", "varchar(160)", (column) => column.notNull())
    .addColumn("occurred_at", "timestamptz", (column) => column.notNull())
    .addColumn("result", "varchar(24)", (column) => column.notNull())
    .addColumn("actor_type", "varchar(24)", (column) => column.notNull())
    .addColumn("actor_id", "uuid")
    .addColumn("subject_id", "uuid")
    .addColumn("actor_reference", "varchar(64)")
    .addColumn("subject_reference", "varchar(64)")
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
  for (const column of ["actor_reference", "subject_reference"] as const) {
    await db.schema
      .createIndex(`audit_events_${column}_idx`)
      .on("audit_events")
      .column(column)
      .execute();
  }
}

async function down(db: Kysely<AuditDatabase>): Promise<void> {
  await db.schema.dropTable("audit_events").ifExists().cascade().execute();
  await db.schema.dropTable("audit_deleted_subjects").ifExists().execute();
}

export const auditMigrations = {
  "006_create_audit": { up, down },
};
