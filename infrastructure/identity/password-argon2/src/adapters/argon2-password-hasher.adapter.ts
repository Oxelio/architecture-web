import argon2 from "argon2";

import type { PasswordHasherPort } from "@architecture/identity/application";
import {
  PasswordHashValueObject,
  type PasswordPlainValueObject,
} from "@architecture/identity/domain";

export class Argon2PasswordHasherAdapter implements PasswordHasherPort {
  private readonly FAKE_HASH = "fake-hash-for-fake-verification";

  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const hashedPassword = await argon2.hash(password.value);

    const passwordHashValueObject =
      PasswordHashValueObject.create(hashedPassword);
    if (!passwordHashValueObject.success) {
      throw new Error("Invalid password value object");
    }

    return passwordHashValueObject.value;
  }

  async fakeVerify(): Promise<void> {
    await argon2.verify(this.FAKE_HASH, "fake-password");
  }
  async verify(
    password: PasswordPlainValueObject,
    hashedPassword: PasswordHashValueObject,
  ): Promise<boolean> {
    return await argon2.verify(hashedPassword.value, password.value);
  }
}
