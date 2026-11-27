import type { Migration } from "kysely/migration";

export const iamOAuthProtocolMigrations: Record<string, Migration> = {
  "013_add_iam_oauth_protocol": {
    async up(db) {
      await db.schema
        .createTable("iam_oauth_families")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("account_id", "uuid", (column) =>
          column.notNull().references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("client_id", "uuid", (column) =>
          column.notNull().references("iam_delegated_clients.id"),
        )
        .addColumn("grant_id", "uuid", (column) =>
          column
            .notNull()
            .references("iam_delegated_grants.id")
            .onDelete("cascade"),
        )
        .addColumn("authority", "jsonb", (column) => column.notNull())
        .addColumn("expires_at", "timestamptz", (column) => column.notNull())
        .addColumn("revoked", "boolean", (column) =>
          column.notNull().defaultTo(false),
        )
        .execute();
      await db.schema
        .createTable("iam_oauth_artifacts")
        .addColumn("model", "text", (column) => column.notNull())
        .addColumn("id", "text", (column) => column.notNull())
        .addColumn("uid", "text")
        .addColumn("account_id", "uuid", (column) =>
          column.references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("family_id", "text", (column) =>
          column.references("iam_oauth_families.id").onDelete("cascade"),
        )
        .addColumn("payload", "bytea", (column) => column.notNull())
        .addColumn("consumed", "integer")
        .addColumn("expires_at", "timestamptz", (column) => column.notNull())
        .addPrimaryKeyConstraint("iam_oauth_artifacts_pk", ["model", "id"])
        .execute();
      await db.schema
        .createTable("iam_oauth_pending")
        .addColumn("id", "text", (column) => column.primaryKey())
        .addColumn("client_id", "uuid", (column) =>
          column.notNull().references("iam_delegated_clients.id"),
        )
        .addColumn("client_revision", "integer", (column) => column.notNull())
        .addColumn("account_id", "uuid", (column) =>
          column.references("iam_users.id").onDelete("cascade"),
        )
        .addColumn("binding", "text")
        .addColumn("consent", "jsonb")
        .addColumn("expires_at", "timestamptz", (column) => column.notNull())
        .addColumn("decided", "boolean", (column) =>
          column.notNull().defaultTo(false),
        )
        .execute();
      const indexedColumns = [
        [
          "iam_oauth_families",
          ["account_id", "client_id", "grant_id", "expires_at"],
        ],
        [
          "iam_oauth_artifacts",
          ["account_id", "family_id", "uid", "expires_at"],
        ],
        ["iam_oauth_pending", ["account_id", "expires_at"]],
      ] as const;
      const indexes = indexedColumns.flatMap(([table, columns]) =>
        columns.map((column) =>
          db.schema.createIndex(`${table}_${column}`).on(table).column(column),
        ),
      );
      await indexes.reduce(async (previous, index) => {
        await previous;
        await index.execute();
      }, Promise.resolve());
    },
    async down(db) {
      await db.schema.dropTable("iam_oauth_pending").execute();
      await db.schema.dropTable("iam_oauth_artifacts").execute();
      await db.schema.dropTable("iam_oauth_families").execute();
    },
  },
};
