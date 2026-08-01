import { sql } from "kysely";
import type { Migration } from "kysely/migration";

export const iamAuthenticationMigrations: Record<string, Migration> = {
  "005_extract_iam_authentication": {
    async up(db) {
      await db.schema
        .createTable("iam_login_identities")
        .addColumn("id", "uuid", (column) => column.primaryKey().notNull())
        .addColumn("user_id", "uuid", (column) =>
          column.references("iam_users.id").onDelete("cascade").notNull(),
        )
        .addColumn("kind", "varchar", (column) => column.notNull())
        .addColumn("normalized_value", "varchar", (column) => column.notNull())
        .addColumn("verification_status", "varchar", (column) =>
          column.notNull(),
        )
        .addColumn("verified_at", "timestamp")
        .addColumn("created_at", "timestamp", (column) => column.notNull())
        .addColumn("updated_at", "timestamp", (column) => column.notNull())
        .addUniqueConstraint("iam_login_identity_kind_value_unique", [
          "kind",
          "normalized_value",
        ])
        .addUniqueConstraint("iam_login_identity_user_kind_unique", [
          "user_id",
          "kind",
        ])
        .addCheckConstraint(
          "iam_login_identity_kind_check",
          sql`kind in ('username', 'email')`,
        )
        .addCheckConstraint(
          "iam_login_identity_verification_status_check",
          sql`verification_status in ('not_required', 'pending', 'verified')`,
        )
        .execute();

      await db.schema
        .createIndex("iam_login_identity_user_idx")
        .on("iam_login_identities")
        .column("user_id")
        .execute();

      await db.schema
        .createTable("iam_password_authenticators")
        .addColumn("id", "uuid", (column) => column.primaryKey().notNull())
        .addColumn("user_id", "uuid", (column) =>
          column
            .references("iam_users.id")
            .onDelete("cascade")
            .notNull()
            .unique(),
        )
        .addColumn("password_hash", "varchar", (column) => column.notNull())
        .addColumn("created_at", "timestamp", (column) => column.notNull())
        .addColumn("updated_at", "timestamp", (column) => column.notNull())
        .addColumn("last_used_at", "timestamp")
        .addColumn("revoked_at", "timestamp")
        .execute();

      await sql`
        insert into iam_login_identities (
          id, user_id, kind, normalized_value, verification_status,
          verified_at, created_at, updated_at
        )
        select
          id, id, 'email', email,
          case when is_email_verified then 'verified' else 'pending' end,
          case when is_email_verified then updated_at else null end,
          created_at, updated_at
        from iam_users
      `.execute(db);

      await sql`
        insert into iam_password_authenticators (
          id, user_id, password_hash, created_at, updated_at,
          last_used_at, revoked_at
        )
        select id, id, password_hash, created_at, updated_at, null, null
        from iam_users
      `.execute(db);

      await db.schema
        .alterTable("iam_email_verifications")
        .addColumn("login_identity_id", "uuid")
        .execute();

      await sql`
        update iam_email_verifications verification
        set login_identity_id = identity.id
        from iam_login_identities identity
        where identity.user_id = verification.user_id
          and identity.kind = 'email'
      `.execute(db);

      await db.schema
        .alterTable("iam_email_verifications")
        .alterColumn("login_identity_id", (column) => column.setNotNull())
        .execute();

      await db.schema
        .alterTable("iam_email_verifications")
        .addForeignKeyConstraint(
          "iam_email_verification_login_identity_foreign",
          ["login_identity_id"],
          "iam_login_identities",
          ["id"],
          (constraint) => constraint.onDelete("cascade"),
        )
        .execute();

      await sql`drop trigger if exists iam_users_invalidate_recoveries on iam_users`.execute(
        db,
      );
      await sql`drop function if exists iam_invalidate_password_recoveries`.execute(
        db,
      );

      await db.schema
        .alterTable("iam_users")
        .dropColumn("email")
        .dropColumn("password_hash")
        .dropColumn("is_email_verified")
        .execute();

      await sql`
        create function iam_invalidate_recoveries_on_user_status()
        returns trigger
        language plpgsql
        as $$
        begin
          if new.status = 'pending_deletion' then
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
        after update of status on iam_users
        for each row execute function iam_invalidate_recoveries_on_user_status();
      `.execute(db);

      await sql`
        create function iam_invalidate_recoveries_on_login_identity()
        returns trigger
        language plpgsql
        as $$
        begin
          if tg_op = 'DELETE' then
            if old.kind = 'email' then
              update iam_password_recoveries
              set invalidated_at = now()
              where user_id = old.user_id
                and consumed_at is null
                and invalidated_at is null;
            end if;
            return old;
          end if;

          if old.kind = 'email' and (
            old.user_id is distinct from new.user_id
            or old.normalized_value is distinct from new.normalized_value
            or old.kind is distinct from new.kind
          ) then
            update iam_password_recoveries
            set invalidated_at = now()
            where user_id = old.user_id
              and consumed_at is null
              and invalidated_at is null;
          end if;
          return new;
        end;
        $$;
      `.execute(db);
      await sql`
        create trigger iam_login_identities_invalidate_recoveries
        after update or delete on iam_login_identities
        for each row execute function iam_invalidate_recoveries_on_login_identity();
      `.execute(db);

      await sql`
        create function iam_invalidate_recoveries_on_authenticator()
        returns trigger
        language plpgsql
        as $$
        begin
          if old.password_hash is distinct from new.password_hash
             or old.revoked_at is distinct from new.revoked_at then
            update iam_password_recoveries
            set invalidated_at = now()
            where user_id = new.user_id
              and consumed_at is null
              and invalidated_at is null;
          end if;
          return new;
        end;
        $$;
      `.execute(db);
      await sql`
        create trigger iam_password_authenticators_invalidate_recoveries
        after update of password_hash, revoked_at on iam_password_authenticators
        for each row execute function iam_invalidate_recoveries_on_authenticator();
      `.execute(db);
    },

    async down(db) {
      await sql`drop trigger if exists iam_password_authenticators_invalidate_recoveries on iam_password_authenticators`.execute(
        db,
      );
      await sql`drop function if exists iam_invalidate_recoveries_on_authenticator`.execute(
        db,
      );
      await sql`drop trigger if exists iam_login_identities_invalidate_recoveries on iam_login_identities`.execute(
        db,
      );
      await sql`drop function if exists iam_invalidate_recoveries_on_login_identity`.execute(
        db,
      );
      await sql`drop trigger if exists iam_users_invalidate_recoveries on iam_users`.execute(
        db,
      );
      await sql`drop function if exists iam_invalidate_recoveries_on_user_status`.execute(
        db,
      );

      await db.schema
        .alterTable("iam_users")
        .addColumn("email", "varchar")
        .addColumn("password_hash", "varchar")
        .addColumn("is_email_verified", "boolean")
        .execute();

      await sql`
        update iam_users users
        set
          email = identity.normalized_value,
          is_email_verified = identity.verification_status = 'verified',
          password_hash = authenticator.password_hash
        from (
          select distinct on (user_id)
            user_id, normalized_value, verification_status
          from iam_login_identities
          order by user_id, case when kind = 'email' then 0 else 1 end
        ) identity
        join iam_password_authenticators authenticator
          on authenticator.user_id = identity.user_id
        where identity.user_id = users.id
      `.execute(db);

      await db.schema
        .alterTable("iam_users")
        .alterColumn("email", (column) => column.setNotNull())
        .execute();
      await db.schema
        .alterTable("iam_users")
        .alterColumn("password_hash", (column) => column.setNotNull())
        .execute();
      await db.schema
        .alterTable("iam_users")
        .alterColumn("is_email_verified", (column) => column.setNotNull())
        .execute();
      await db.schema
        .alterTable("iam_users")
        .addUniqueConstraint("iam_users_email_unique", ["email"])
        .execute();

      await db.schema
        .alterTable("iam_email_verifications")
        .dropConstraint("iam_email_verification_login_identity_foreign")
        .execute();
      await db.schema
        .alterTable("iam_email_verifications")
        .dropColumn("login_identity_id")
        .execute();

      await db.schema.dropTable("iam_password_authenticators").execute();
      await db.schema.dropTable("iam_login_identities").execute();

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
    },
  },
};
