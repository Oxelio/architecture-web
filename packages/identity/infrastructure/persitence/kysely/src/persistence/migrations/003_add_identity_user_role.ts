import type { Migration } from "kysely/migration";

export const identityUserRoleMigrations: Record<string, Migration> = {
  "003_add_identity_user_role": {
    async up(db) {
      await db.schema
        .alterTable("identity_users")
        .addColumn("role", "varchar", (col) => col.notNull().defaultTo("user"))
        .execute();
    },
    async down(db) {
      await db.schema.alterTable("identity_users").dropColumn("role").execute();
    },
  },
};
