// @file apps/api/src/composition-root/database.module.ts

import type { IamDatabase } from "@architecture/iam-persistence-kysely";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { AppConfig } from "#config/app.config";

export type AppDatabase = IamDatabase;

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
