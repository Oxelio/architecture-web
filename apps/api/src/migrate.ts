import { config } from "dotenv";
import { Migrator, type MigrationProvider } from "kysely/migration";

import { postgresIdentityMigrations } from "@architecture/identity/infrastructure/persistence/migrations/postgres";
import { createDatabase } from "./database.js";

config({ path: new URL("../.env", import.meta.url) });

const db = createDatabase();

const migrator = new Migrator({
  db,
  provider: {
    async getMigrations() {
      return postgresIdentityMigrations;
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
