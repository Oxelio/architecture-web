import { AssignUserRoleUseCase } from "@architecture/identity/application";
import { EmailValueObject } from "@architecture/identity/domain";
import { KyselyUserAdapter } from "@architecture/identity-persistence-kysely";

import { createDatabase } from "#composition-root/database.module";
import { loadConfig } from "#config/app.config";

const emailArgument = process.argv[2];
if (!emailArgument) {
  console.error("Usage: pnpm promote:admin <email>");
  process.exit(1);
}

const email = EmailValueObject.create(emailArgument);
if (!email.success) {
  console.error("The email address is invalid.");
  process.exit(1);
}

const config = loadConfig();
const db = createDatabase(config.database);
const userRepository = new KyselyUserAdapter(db);

try {
  const user = await userRepository.findByEmail(email.value);
  if (!user) {
    console.error("No user exists for this email address.");
    process.exitCode = 1;
  } else {
    const result = await new AssignUserRoleUseCase(userRepository).execute({
      userId: user.identifier.value,
      role: "admin",
    });

    if (!result.success) {
      console.error(`Unable to promote user: ${result.error.code}`);
      process.exitCode = 1;
    } else {
      console.log(`Promoted ${user.email.value} to admin.`);
    }
  }
} finally {
  await db.destroy();
}
