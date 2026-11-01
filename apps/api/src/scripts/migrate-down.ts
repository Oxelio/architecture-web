// @file apps/api/src/scripts/migrate-down.ts

import { Migrator } from "kysely/migration";

import { createDatabase } from "#composition-root/database.module";
import { loadConfig } from "#config/app.config";

import { getAllMigrations } from "./migrations.provider.js";

const config = loadConfig();
const db = createDatabase(config.database);

const migrator = new Migrator({
  db,
  provider: {
    getMigrations() {
      try {
        return Promise.resolve(getAllMigrations());
      } catch (error: unknown) {
        return Promise.reject(error);
      }
    },
  },
});

// rollback 1 step
const { error, results } = await migrator.migrateDown();

results?.forEach((result) => {
  if (result.status === "Success") {
    console.log(`⬅️ Rolled back: ${result.migrationName}`);
  } else {
    console.error(`❌ rollback failed: ${result.migrationName}`);
  }
});

await db.destroy();

if (error) {
  console.error(error);
  process.exit(1);
}
