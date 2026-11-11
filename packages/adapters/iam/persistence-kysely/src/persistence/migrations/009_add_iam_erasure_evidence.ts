import { sql } from "kysely";
import type { Migration } from "kysely/migration";

export const iamErasureEvidenceMigrations: Record<string, Migration> = {
  "009_add_iam_erasure_evidence": {
    async up(db) {
      await db.schema
        .createTable("iam_account_erasure_evidence")
        .addColumn("subject_key", "bytea", (column) => column.primaryKey())
        .addCheckConstraint(
          "iam_erasure_evidence_subject_key_length",
          sql`octet_length(subject_key) = 32`,
        )
        .execute();
    },
    down() {
      return Promise.reject(
        new Error("Use a forward migration to preserve IAM erasure evidence"),
      );
    },
  },
};
