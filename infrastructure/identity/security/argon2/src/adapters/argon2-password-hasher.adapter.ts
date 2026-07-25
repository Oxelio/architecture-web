// @file infrastructure/identity/security/argon2/src/adapters/argon2-password-hasher.adapter.ts

import type { PasswordHasher } from "@architecture/identity/application";
import {
  PasswordHashValueObject,
  type PasswordPlainValueObject,
} from "@architecture/identity/domain";
import argon2 from "argon2";

export class Argon2PasswordHasherAdapter implements PasswordHasher {
  private readonly FAKE_HASH =
    "$argon2id$v=19$m=65536,t=3,p=4$C4VnZkq4QmZzZzZzZzZzZg$QwqQwqQwqQwqQwqQwqQwqQ";

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
