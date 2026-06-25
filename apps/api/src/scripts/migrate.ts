// apps/api/src/scripts/migrate.ts

import { config } from "dotenv";
import { Migrator, type MigrationProvider } from "kysely/migration";

import { createDatabase } from "../composition-root/database.container.js";
import { identityUserMigrations } from "@architecture/identity/infrastructure";

config({ path: new URL("../.env", import.meta.url) });

const db = createDatabase();

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return identityUserMigrations;
    },
  } satisfies MigrationProvider,
});

const { error, results } = await migrator.migrateToLatest();

for (const result of results ?? []) {
  if (result.status === "Success") {
    console.log(`Migration ${result.migrationName} executed successfully`);
  } else if (result.status === "Error") {
    console.error(`Migration ${result.migrationName} failed`);
  }
}

await db.destroy();

if (error) {
  console.error(error);
  process.exit(1);
}
