import { sql } from "kysely";
import type { Migration } from "kysely/migration";

export const iamDelegatedAuthorizationMigrations: Record<string, Migration> = {
  "012_add_iam_delegated_authorization": {
    async up(db) {
      await db.schema
        .createTable("iam_delegated_clients")
        .addColumn("id", "uuid", (column) => column.primaryKey())
        .addColumn("public_id", "text", (column) => column.notNull().unique())
        .addColumn("display_name", "text", (column) => column.notNull())
        .addColumn("redirect_uris", sql`text[]`, (column) => column.notNull())
        .addColumn("enabled", "boolean", (column) => column.notNull())
        .addColumn("revision", "integer", (column) => column.notNull())
        .addColumn("policies", "jsonb", (column) => column.notNull())
        .execute();

      await db.schema
        .createTable("iam_delegated_grants")
        .addColumn("id", "uuid", (column) => column.primaryKey())
        .addColumn("account_id", "uuid", (column) =>
          column.notNull().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("client_id", "uuid", (column) =>
          column.notNull().references("iam_delegated_clients.id"),
        )
        .addColumn("resource_id", "text", (column) => column.notNull())
        .addColumn("authorized_at", "timestamptz", (column) => column.notNull())
        .addColumn("revoked_at", "timestamptz")
        .addColumn("permissions", "jsonb", (column) => column.notNull())
        .execute();

      await db.schema
        .createIndex("iam_delegated_active_grant")
        .on("iam_delegated_grants")
        .columns(["account_id", "client_id", "resource_id"])
        .unique()
        .where(sql<boolean>`revoked_at is null`)
        .execute();
      await db.schema
        .createIndex("iam_delegated_grants_by_account")
        .on("iam_delegated_grants")
        .column("account_id")
        .execute();
      await db.schema
        .createIndex("iam_delegated_grants_by_client_resource")
        .on("iam_delegated_grants")
        .columns(["client_id", "resource_id"])
        .execute();

      await db.schema
        .createTable("iam_delegated_account_epochs")
        .addColumn("account_id", "uuid", (column) =>
          column.primaryKey().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("epoch", "bigint", (column) => column.notNull().defaultTo(0))
        .execute();

      await db.schema
        .createTable("iam_delegated_tuple_epochs")
        .addColumn("account_id", "uuid", (column) =>
          column.notNull().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("client_id", "uuid", (column) =>
          column.notNull().references("iam_delegated_clients.id"),
        )
        .addColumn("resource_id", "text", (column) => column.notNull())
        .addColumn("epoch", "bigint", (column) => column.notNull().defaultTo(0))
        .addPrimaryKeyConstraint("iam_delegated_tuple_epochs_pk", [
          "account_id",
          "client_id",
          "resource_id",
        ])
        .execute();
    },
    down() {
      return Promise.reject(
        new Error(
          "Use a forward migration to preserve delegated authorization lifecycles",
        ),
      );
    },
  },
};
