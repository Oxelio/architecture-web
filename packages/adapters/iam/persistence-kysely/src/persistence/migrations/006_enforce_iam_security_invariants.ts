import { sql } from "kysely";
import type { Migration } from "kysely/migration";
export const iamSecurityInvariantMigrations: Record<string, Migration> = {
  "006_enforce_iam_security_invariants": {
    async up(db) {
      await sql`create unique index iam_one_published_security_revision on iam_security_config_revisions (status) where status = 'published'`.execute(
        db,
      );
    },
    async down(db) {
      await sql`drop index iam_one_published_security_revision`.execute(db);
    },
  },
};
