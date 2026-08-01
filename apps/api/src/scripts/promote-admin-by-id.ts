import { UserIdentifierValueObject } from "@architecture/iam/domain";

import { createDatabase } from "#composition-root/database.module";
import { loadConfig } from "#config/app.config";

const userIdArgument = process.argv[2];
if (!userIdArgument) {
  console.error("Usage: pnpm promote:admin:id <user-id>");
  process.exit(1);
}

const userId = UserIdentifierValueObject.create(userIdArgument);
if (!userId.success) {
  console.error("Invalid user identifier.");
  process.exit(1);
}

const database = createDatabase(loadConfig().database);
try {
  const result = await database
    .updateTable("iam_users")
    .set({ role: "admin", updated_at: new Date() })
    .where("id", "=", userId.value.value)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    console.error("No user exists for this identifier.");
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${userId.value.value} to admin.`);
  }
} finally {
  await database.destroy();
}
