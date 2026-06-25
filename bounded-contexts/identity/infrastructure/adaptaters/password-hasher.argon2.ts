import argon2 from "argon2";

import type { PasswordHasherPort } from "../../application/ports/password-hasher.port.js";
import type { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";

export class PasswordHasherArgon2 implements PasswordHasherPort {
  private readonly FAKE_HASH = "fake-hash-for-fake-verification";

  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const hashedPassword = await argon2.hash(password.value);
    return PasswordHashValueObject.create(hashedPassword);
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
