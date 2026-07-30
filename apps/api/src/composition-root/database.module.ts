// @file apps/api/src/composition-root/database.module.ts

import type { AuditDatabase } from "@architecture/audit";
import type { IamDatabase } from "@architecture/iam-persistence-kysely";
import type { MessagingDatabase } from "@architecture/messaging";
import type { NotificationDatabase } from "@architecture/notifications";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { AppConfig } from "#config/app.config";

export type AppDatabase = IamDatabase &
  MessagingDatabase &
  AuditDatabase &
  NotificationDatabase;

export function createDatabase(dbConfig: AppConfig["database"]) {
  return new Kysely<AppDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.name,
        user: dbConfig.user,
        password: dbConfig.password,
      }),
    }),
  });
}
