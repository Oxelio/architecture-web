// @file apps/api/src/scripts/migrations.provider.ts

import {
  iamAggregateConsistencyMigrations,
  iamEmailVerificationMigrations,
  iamSecurityMigrations,
  iamUserMigrations,
} from "@architecture/iam-persistence-kysely";
import type { Migration } from "kysely/migration";

export const getAllMigrations = (): Record<string, Migration> => {
  return {
    ...iamUserMigrations,
    ...iamEmailVerificationMigrations,
    ...iamSecurityMigrations,
    ...iamAggregateConsistencyMigrations,
  };
};
