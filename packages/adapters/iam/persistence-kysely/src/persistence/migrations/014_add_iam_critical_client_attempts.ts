import { sql } from "kysely";
import type { Migration } from "kysely/migration";

export const iamCriticalClientAttemptMigrations: Record<string, Migration> = {
  "014_add_iam_critical_client_attempts": {
    async up(db) {
      await db.schema
        .createTable("iam_critical_client_attempts")
        .addColumn("user_id", "uuid", (column) =>
          column.primaryKey().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("timestamps", sql`timestamptz[]`, (column) =>
          column.notNull(),
        )
        .execute();
    },
    async down(db) {
      await db.schema.dropTable("iam_critical_client_attempts").execute();
    },
  },
};
