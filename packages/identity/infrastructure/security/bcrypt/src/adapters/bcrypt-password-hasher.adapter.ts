// @file infrastructure/identity/security/bcrypt/src/adapters/bcrypt-password-hasher.adapter.ts

import { createHash } from "node:crypto";

import type { PasswordHasher } from "@architecture/identity/application";
import {
  PasswordHashValueObject,
  type PasswordPlainValueObject,
} from "@architecture/identity/domain";
import bcrypt from "bcrypt";

export class BcryptPasswordHasherAdapter implements PasswordHasher {
  private readonly SALT_ROUNDS = 12;
  private readonly PREHASH_PREFIX = "bcrypt-sha256:";

  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const hashedPassword =
      this.PREHASH_PREFIX +
      (await bcrypt.hash(this.prehash(password.value), this.SALT_ROUNDS));

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
    if (hashedPassword.value.startsWith(this.PREHASH_PREFIX)) {
      return bcrypt.compare(
        this.prehash(password.value),
        hashedPassword.value.slice(this.PREHASH_PREFIX.length),
      );
    }

    // Compatibility path for hashes created before SHA-256 prehashing.
    return bcrypt.compare(password.value, hashedPassword.value);
  }

  private prehash(password: string): string {
    return createHash("sha256").update(password, "utf8").digest("base64");
  }
}
