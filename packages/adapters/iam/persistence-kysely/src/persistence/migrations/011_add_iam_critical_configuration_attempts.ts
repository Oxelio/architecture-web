import { sql } from "kysely";
import type { Migration } from "kysely/migration";

export const iamCriticalConfigurationAttemptMigrations: Record<
  string,
  Migration
> = {
  "011_add_iam_critical_configuration_attempts": {
    async up(db) {
      await db.schema
        .createTable("iam_critical_configuration_attempts")
        .addColumn("user_id", "uuid", (column) =>
          column.primaryKey().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("timestamps", sql`timestamptz[]`, (column) =>
          column.notNull(),
        )
        .addCheckConstraint(
          "iam_critical_configuration_attempt_count",
          sql`cardinality(timestamps) between 1 and 5`,
        )
        .execute();
    },
    down() {
      return Promise.reject(
        new Error(
          "Use a forward migration to preserve critical confirmation attempts",
        ),
      );
    },
  },
};
