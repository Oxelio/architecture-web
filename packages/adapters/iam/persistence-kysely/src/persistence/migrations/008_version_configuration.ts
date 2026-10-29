import { sql } from "kysely";
import type { Migration } from "kysely/migration";
export const iamConfigurationVersionMigrations: Record<string, Migration> = {
  "008_version_configuration": {
    async up(db) {
      await sql`alter table iam_security_config_revisions add column representation_version integer not null default 1, add column comparison_data jsonb, add column justification text, add column origin varchar(32), add column restored_from_revision_id uuid`.execute(
        db,
      );
    },
    async down() {
      throw new Error("Configuration history requires a forward migration");
    },
  },
};
