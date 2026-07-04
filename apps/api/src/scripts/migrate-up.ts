// apps/api/src/scripts/migrate-up.ts

import { config } from "dotenv";
import { Migrator } from "kysely/migration";

import { createDatabase } from "../composition-root/database.container.js";
import { getAllMigrations } from "./migrations.provider.js";

config({ path: new URL("../../.env", import.meta.url) });

const db = createDatabase();

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
