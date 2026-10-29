import { type Kysely, sql } from "kysely";

import type { IamDatabase } from "#persistence/schema";

async function up(db: Kysely<IamDatabase>): Promise<void> {
  await db.schema
    .createTable("iam_password_recoveries")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) =>
      column.references("iam_users.id").onDelete("cascade").notNull(),
    )
    .addColumn("token_hash", "varchar(64)", (column) =>
      column.unique().notNull(),
    )
    .addColumn("email_fingerprint", "varchar(64)", (column) => column.notNull())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("invalidated_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createIndex("iam_password_recoveries_user_idx")
    .on("iam_password_recoveries")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("iam_mfa_settings")
    .addColumn("user_id", "uuid", (column) =>
      column
        .primaryKey()
        .references("iam_users.id")
        .onDelete("cascade")
        .notNull(),
    )
    .addColumn("encrypted_secret", "text", (column) => column.notNull())
    .addColumn("enrollment_expires_at", "timestamptz")
    .addColumn("enabled_at", "timestamptz")
    .addColumn("last_totp_counter", "varchar(32)")
    .addColumn("created_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("iam_mfa_backup_codes")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) =>
      column.references("iam_users.id").onDelete("cascade").notNull(),
    )
    .addColumn("code_hash", "varchar(64)", (column) => column.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .addUniqueConstraint("iam_mfa_backup_code_unique", ["user_id", "code_hash"])
    .execute();

  await db.schema
    .createTable("iam_mfa_challenges")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) =>
      column.references("iam_users.id").onDelete("cascade").notNull(),
    )
    .addColumn("purpose", "varchar(32)", (column) => column.notNull())
    .addColumn("attempts", "integer", (column) => column.defaultTo(0).notNull())
    .addColumn("max_attempts", "integer", (column) => column.notNull())
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("consumed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.defaultTo(sql`now()`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("iam_security_config_revisions")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("version", "integer", (column) => column.unique().notNull())
    .addColumn("status", "varchar(24)", (column) => column.notNull())
    .addColumn("values", "jsonb", (column) => column.notNull())
    .addColumn("created_by", "uuid", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .addColumn("published_at", "timestamptz")
    .addColumn("previous_revision_id", "uuid")
    .execute();

  await db.schema
    .createTable("iam_account_exports")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) =>
      column.references("iam_users.id").onDelete("cascade").notNull(),
    )
    .addColumn("status", "varchar(24)", (column) => column.notNull())
    .addColumn("archive", "bytea")
    .addColumn("failure_code", "varchar(64)")
    .addColumn("expires_at", "timestamptz")
    .addColumn("downloaded_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) => column.notNull())
    .addColumn("updated_at", "timestamptz", (column) => column.notNull())
    .execute();

  await db.schema
    .createTable("iam_account_deletions")
    .addColumn("id", "uuid", (column) => column.primaryKey())
    .addColumn("user_id", "uuid", (column) =>
      column.references("iam_users.id").onDelete("cascade").notNull(),
    )
    .addColumn("previous_status", "varchar(24)", (column) => column.notNull())
    .addColumn("cancellation_token_hash", "varchar(64)", (column) =>
      column.unique().notNull(),
    )
    .addColumn("requested_at", "timestamptz", (column) => column.notNull())
    .addColumn("scheduled_for", "timestamptz", (column) => column.notNull())
    .addColumn("cancelled_at", "timestamptz")
    .addColumn("executed_at", "timestamptz")
    .addColumn("legal_hold_reason", "text")
    .addUniqueConstraint("iam_account_deletion_user_unique", ["user_id"])
    .execute();

  await sql`
    create function iam_invalidate_password_recoveries()
    returns trigger
    language plpgsql
    as $$
    begin
      if old.email is distinct from new.email
         or old.password_hash is distinct from new.password_hash
         or new.status = 'pending_deletion' then
        update iam_password_recoveries
        set invalidated_at = now()
        where user_id = new.id
          and consumed_at is null
          and invalidated_at is null;
      end if;
      return new;
    end;
    $$;
  `.execute(db);
  await sql`
    create trigger iam_users_invalidate_recoveries
    after update of email, password_hash, status on iam_users
    for each row execute function iam_invalidate_password_recoveries();
  `.execute(db);
}

async function down(db: Kysely<IamDatabase>): Promise<void> {
  await sql`drop trigger if exists iam_users_invalidate_recoveries on iam_users`.execute(
    db,
  );
  await sql`drop function if exists iam_invalidate_password_recoveries`.execute(
    db,
  );
  for (const table of [
    "iam_account_deletions",
    "iam_account_exports",
    "iam_security_config_revisions",
    "iam_mfa_challenges",
    "iam_mfa_backup_codes",
    "iam_mfa_settings",
    "iam_password_recoveries",
  ] as const) {
    await db.schema.dropTable(table).ifExists().cascade().execute();
  }
}

export const iamSecurityMigrations = {
  "003_create_iam_security": { up, down },
};
