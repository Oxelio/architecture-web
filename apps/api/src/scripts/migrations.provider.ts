// @file apps/api/src/scripts/migrations.provider.ts

import {
  identityEmailVerificationMigrations,
  identityUserMigrations,
  identityUserRoleMigrations,
} from "@architecture/identity-persistence-kysely";
import type { Migration } from "kysely/migration";

export const getAllMigrations = (): Record<string, Migration> => {
  return {
    ...identityUserMigrations,
    ...identityEmailVerificationMigrations,
    ...identityUserRoleMigrations,
  };
};
