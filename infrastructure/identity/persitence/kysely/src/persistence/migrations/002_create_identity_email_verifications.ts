import type { Migration } from "kysely/migration";

export const identityEmailVerificationMigrations: Record<string, Migration> = {
  "002_create_identity_email_verifications": {
    async up(db) {
      await db.schema
        .createTable("identity_email_verifications")
        .addColumn("token", "varchar", (col) => col.primaryKey().notNull())
        .addColumn("user_id", "uuid", (col) => col.notNull())
        .addColumn("expires_at", "timestamp", (col) => col.notNull())
        .addColumn("used", "boolean", (col) => col.notNull().defaultTo(false))
        .addColumn("created_at", "timestamp", (col) =>
          col.notNull().defaultTo(new Date()),
        )
        .execute();
    },
    async down(db) {
      await db.schema.dropTable("identity_email_verifications").execute();
    },
  },
};
