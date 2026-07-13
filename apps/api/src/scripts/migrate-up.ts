// @file apps/api/src/scripts/migrate-up.ts

// apps/api/src/scripts/migrate-up.ts

import { Migrator } from "kysely/migration";
import { createDatabase } from "../composition-root/database.container.js";
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

const { error, results } = await migrator.migrateToLatest();

results?.forEach((result) => {
  if (result.status === "Success") {
    console.log(`✅ ${result.migrationName}`);
  } else {
    console.error(`❌ ${result.migrationName}`);
  }
});

await db.destroy();

if (error) {
  console.error(error);
  process.exit(1);
}
