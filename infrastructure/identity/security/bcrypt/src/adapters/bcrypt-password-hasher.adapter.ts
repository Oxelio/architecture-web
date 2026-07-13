// @file infrastructure/identity/security/bcrypt/src/adapters/bcrypt-password-hasher.adapter.ts

import bcrypt from "bcrypt";

import type { PasswordHasherPort } from "@architecture/identity/application";
import {
  PasswordHashValueObject,
  type PasswordPlainValueObject,
} from "@architecture/identity/domain";

export class BcryptPasswordHasherAdapter implements PasswordHasherPort {
  private readonly SALT_ROUNDS = 12;

  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const hashedPassword = await bcrypt.hash(password.value, this.SALT_ROUNDS);

    const passwordHashValueObject =
      PasswordHashValueObject.create(hashedPassword);

    if (!passwordHashValueObject.success) {
      throw new Error("Invalid password hash value object");
    }

    return passwordHashValueObject.value;
  }

  async fakeVerify(): Promise<void> {
    await bcrypt.compare(
      "fake-password",
      "$2b$12$invalidsaltinvalidsaltinvalidsaltinv",
    );
  }

  async verify(
    password: PasswordPlainValueObject,
    hashedPassword: PasswordHashValueObject,
  ): Promise<boolean> {
    return bcrypt.compare(password.value, hashedPassword.value);
  }
}
