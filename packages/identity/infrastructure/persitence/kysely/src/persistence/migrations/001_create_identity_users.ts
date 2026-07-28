// @file infrastructure/identity/persitence/kysely/src/persistence/migrations/001_create_identity_users.ts

import type { Migration } from "kysely/migration";

export const identityUserMigrations: Record<string, Migration> = {
  "001_create_identity_users": {
    async up(db) {
      await db.schema
        .createTable("identity_users")
        .addColumn("id", "uuid", (col) => col.primaryKey().notNull())
        .addColumn("email", "varchar", (col) => col.notNull().unique())
        .addColumn("password_hash", "varchar", (col) => col.notNull())
        .addColumn("role", "varchar", (col) => col.notNull())
        .addColumn("status", "varchar", (col) => col.notNull())
        .addColumn("is_email_verified", "boolean", (col) => col.notNull())
        .addColumn("created_at", "timestamp", (col) => col.notNull())
        .addColumn("updated_at", "timestamp", (col) => col.notNull())
        .execute();
    },
    async down(db) {
      await db.schema.dropTable("identity_users").execute();
    },
  },
};
