// src/composition-root/database.ts

import { Kysely, PostgresDialect } from "kysely";
import type { IdentityDatabase } from "@architecture/identity/infrastructure";
import { Pool } from "pg";

export type AppDatabase = IdentityDatabase;

export function createDatabase() {
  const host = process.env["DATABASE_HOST"];
  const port = process.env["DATABASE_PORT"];
  const database = process.env["DATABASE_NAME"];
  const user = process.env["DATABASE_USER"];
  const password = process.env["DATABASE_PASSWORD"];

  if (!host || !port || !database || !user || !password) {
    throw new Error("Database environment variables are missing");
  }

  return new Kysely<AppDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host,
        port: Number(port),
        database,
        user,
        password,
      }),
    }),
  });
}
