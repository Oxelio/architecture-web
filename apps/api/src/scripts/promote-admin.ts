import { EmailValueObject } from "@architecture/iam/domain";

import { createDatabase } from "#composition-root/database.module";
import { loadConfig } from "#config/app.config";

const emailArgument = process.argv[2];
if (!emailArgument) {
  console.error("Usage: pnpm promote:admin <email>");
  process.exit(1);
}

const email = EmailValueObject.create(emailArgument);
if (!email.success) {
  console.error("Invalid email address.");
  process.exit(1);
}

const database = createDatabase(loadConfig().database);
try {
  const result = await database
    .updateTable("iam_users")
    .set({ role: "admin", updated_at: new Date() })
    .where("email", "=", email.value.value)
    .executeTakeFirst();

  if (result.numUpdatedRows === 0n) {
    console.error("No user exists for this email address.");
    process.exitCode = 1;
  } else {
    console.log(`Promoted ${email.value.value} to admin.`);
  }
} finally {
  await database.destroy();
}
