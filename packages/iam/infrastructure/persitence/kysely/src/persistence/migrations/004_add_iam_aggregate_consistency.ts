import type { Migration } from "kysely/migration";

export const iamAggregateConsistencyMigrations: Record<string, Migration> = {
  "004_add_iam_aggregate_consistency": {
    async up(db) {
      await db.schema
        .alterTable("iam_users")
        .addColumn("session_version", "integer", (column) =>
          column.notNull().defaultTo(1),
        )
        .execute();
      await db.schema
        .alterTable("iam_email_verifications")
        .addForeignKeyConstraint(
          "iam_email_verifications_user_id_foreign",
          ["user_id"],
          "iam_users",
          ["id"],
          (constraint) => constraint.onDelete("cascade"),
        )
        .execute();
    },
    async down(db) {
      await db.schema
        .alterTable("iam_email_verifications")
        .dropConstraint("iam_email_verifications_user_id_foreign")
        .execute();
      await db.schema
        .alterTable("iam_users")
        .dropColumn("session_version")
        .execute();
    },
  },
};
