// @file apps/api/src/scripts/migrate-down.ts

// apps/api/src/scripts/migrate-down.ts

import { Migrator } from "kysely/migration";
import { createDatabase } from "#composition-root/database.container";
import { getAllMigrations } from "./migrations.provider.js";
import { loadConfig } from "../config/app.config.js";

const config = loadConfig();
const db = createDatabase(config.database);

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return getAllMigrations();
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
