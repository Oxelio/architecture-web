// @file apps/api/src/scripts/migrate-reset.ts

import { Migrator } from "kysely/migration";

import { createDatabase } from "../composition-root/database.container.js";
import { loadConfig } from "../config/app.config.js";
import { getAllMigrations } from "./migrations.provider.js";

const config = loadConfig();
const db = createDatabase(config.database);

console.log("💣 Dropping all tables...");

await db.schema.dropSchema("public").ifExists().cascade().execute();

await db.schema.createSchema("public").execute();

console.log("♻️ Running migrations...");

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return getAllMigrations();
    },
  },
});

const { error } = await migrator.migrateToLatest();

await db.destroy();

if (error) {
  console.error(error);
  process.exit(1);
}

console.log("✅ Reset completed");
