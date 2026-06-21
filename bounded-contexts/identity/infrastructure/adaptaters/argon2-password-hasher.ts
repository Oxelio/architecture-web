import argon2 from "argon2";

import type { PasswordHasherContract } from "#contracts/password-hasher";
import type { PasswordPlain } from "#value-objects/password-plain";
import { PasswordHash } from "#value-objects/password-hash";

export class Argon2PasswordHasher implements PasswordHasherContract {
  private readonly FAKE_HASH = "fake-hash-for-fake-verification";

  async hash(password: PasswordPlain): Promise<PasswordHash> {
    const hashedPassword = await argon2.hash(password.value);
    return PasswordHash.create(hashedPassword);
  }

  async fakeVerify(): Promise<void> {
    await argon2.verify(this.FAKE_HASH, "fake-password");
  }
  async verify(
    password: PasswordPlain,
    hashedPassword: PasswordHash,
  ): Promise<boolean> {
    return await argon2.verify(hashedPassword.value, password.value);
  }
}
