// @file apps/api/src/scripts/migrations.provider.ts

import { auditMigrations } from "@architecture/audit";
import {
  iamAggregateConsistencyMigrations,
  iamEmailVerificationMigrations,
  iamSecurityMigrations,
  iamUserMigrations,
} from "@architecture/iam-persistence-kysely";
import { messagingMigrations } from "@architecture/messaging-persistence-kysely";
import { notificationMigrations } from "@architecture/notifications-persistence-kysely";
import type { Migration } from "kysely/migration";

export const getAllMigrations = (): Record<string, Migration> => {
  return {
    ...iamUserMigrations,
    ...iamEmailVerificationMigrations,
    ...iamSecurityMigrations,
    ...iamAggregateConsistencyMigrations,
    ...messagingMigrations,
    ...auditMigrations,
    ...notificationMigrations,
  };
};
