// src/composition-root/database.ts

import { Kysely, PostgresDialect } from "kysely";
import type { IdentityDatabase } from "@architecture/identity/infrastructure";
import { Pool } from "pg";

export type AppDatabase = IdentityDatabase;

export function createDatabase() {
  const connectionString = process.env["DATABASE_URL"];

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  return new Kysely<AppDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
      }),
    }),
  });
}
