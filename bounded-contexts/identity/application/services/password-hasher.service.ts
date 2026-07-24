// @file bounded-contexts/identity/application/ports/password-hasher.port.ts

import type { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";

export abstract class PasswordHasher {
  abstract hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject>;
  abstract fakeVerify(): Promise<void>;
  abstract verify(
    password: PasswordPlainValueObject,
    hashedPassword: PasswordHashValueObject,
  ): Promise<boolean>;
}
