import type { PasswordHash } from "#value-objects/password-hash";
import type { PasswordPlain } from "#value-objects/password-plain";

export abstract class PasswordHasherContract {
  abstract hash(password: PasswordPlain): Promise<PasswordHash>;
  abstract fakeVerify(): Promise<void>;
  abstract verify(
    password: PasswordPlain,
    hashedPassword: PasswordHash,
  ): Promise<boolean>;
}
