// @file infrastructure/iam/persitence/kysely/src/persistence/migrations/002_create_iam_email_verifications.ts

import type { Migration } from "kysely/migration";

export const iamEmailVerificationMigrations: Record<string, Migration> = {
  "002_create_iam_email_verifications": {
    async up(db) {
      await db.schema
        .createTable("iam_email_verifications")
        .addColumn("token_hash", "char(64)", (col) =>
          col.primaryKey().notNull(),
        )
        .addColumn("user_id", "uuid", (col) => col.notNull())
        .addColumn("expires_at", "timestamp", (col) => col.notNull())
        .addColumn("used", "boolean", (col) => col.notNull())
        .addColumn("invalidated", "boolean", (col) => col.notNull())
        .addColumn("created_at", "timestamp", (col) =>
          col.notNull().defaultTo(new Date()),
        )
        .execute();
    },
    async down(db) {
      await db.schema.dropTable("iam_email_verifications").execute();
    },
  },
};
