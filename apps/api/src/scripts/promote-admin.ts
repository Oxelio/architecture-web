import { buildApplicationModule } from "#composition-root/application.module";

const emailArgument = process.argv[2];
if (!emailArgument) {
  console.error("Usage: pnpm promote:admin <email>");
  process.exit(1);
}

const application = buildApplicationModule();

try {
  const users = await application.identity.listUsers.execute();
  if (!users.success) {
    throw new Error("ListUsers cannot fail");
  }

  const user = users.value.find(
    ({ email }) => email.toLowerCase() === emailArgument.toLowerCase(),
  );

  if (!user) {
    console.error("No user exists for this email address.");
    process.exitCode = 1;
  } else {
    const result = await application.identity.assignUserRole.execute({
      userId: user.userId,
      role: "admin",
    });

    if (!result.success) {
      console.error(`Unable to promote user: ${result.error.code}`);
      process.exitCode = 1;
    } else {
      console.log(`Promoted ${user.email} to admin.`);
    }
  }
} finally {
  await application.dispose();
}
