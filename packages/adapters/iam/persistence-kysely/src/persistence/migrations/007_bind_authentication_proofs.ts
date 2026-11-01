import { sql } from "kysely";
import type { Migration } from "kysely/migration";
export const iamAuthenticationProofMigrations: Record<string, Migration> = {
  "007_bind_authentication_proofs": {
    async up(db) {
      await sql`alter table iam_login_identities add column generation integer not null default 1`.execute(
        db,
      );
      await sql`create function iam_identity_generation() returns trigger language plpgsql as $$ begin
        if old.normalized_value is distinct from new.normalized_value or old.verification_status is distinct from new.verification_status then new.generation := old.generation + 1; end if;
        return new; end $$`.execute(db);
      await sql`create trigger iam_identity_generation before update on iam_login_identities for each row execute function iam_identity_generation()`.execute(
        db,
      );
      await sql`alter table iam_password_recoveries add column login_identity_id uuid, add column identity_generation integer`.execute(
        db,
      );
      // Historical fingerprints cannot prove the identity generation at issuance. Retain rows without reactivating unbound proofs.
      await sql`update iam_password_recoveries set invalidated_at = coalesce(invalidated_at, current_timestamp) where consumed_at is null`.execute(
        db,
      );
      await sql`alter table iam_mfa_challenges add column user_session_version integer`.execute(
        db,
      );
      await sql`update iam_mfa_challenges set consumed_at = coalesce(consumed_at, current_timestamp) where purpose = 'signin'`.execute(
        db,
      );
    },
    down() {
      return Promise.reject(
        new Error(
          "Use a forward migration: rollback must not reactivate unbound authentication proofs",
        ),
      );
    },
  },
};
