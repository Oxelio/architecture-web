import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

export function createAdministrator(
  emailAddress = "administrator@example.com",
): UserEntity {
  const email = EmailValueObject.create(emailAddress);
  const password = PasswordHashValueObject.create("administrator-hash");
  if (!email.success || !password.success) {
    throw new Error("Invalid administrator fixture");
  }

  const administrator = UserEntity.create({
    email: email.value,
    password: password.value,
  });
  administrator.changeRole(UserRoleValueObject.admin());
  return administrator;
}
