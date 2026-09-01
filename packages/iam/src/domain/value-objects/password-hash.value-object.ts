// @file bounded-contexts/iam/domain/value-objects/password-hash.value-object.ts

import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const HashedPasswordErrors = {
  empty: {
    code: "hashed_password.empty",
  },
  invalidCharacters: {
    code: "hashed_password.invalid_characters",
  },
} as const;

export type HashedPasswordError = ValueOf<typeof HashedPasswordErrors>;

export class PasswordHashValueObject extends ValueObject<{ value: string }> {
  get value(): string {
    return this.properties.value;
  }

  static create(
    value: string,
  ): Result<PasswordHashValueObject, HashedPasswordError> {
    if (value.length === 0) {
      return Result.failure(HashedPasswordErrors.empty);
    }

    if (/[\r\n\t]/.test(value)) {
      return Result.failure(HashedPasswordErrors.invalidCharacters);
    }

    return Result.success(
      new PasswordHashValueObject({
        value: value,
      }),
    );
  }
}
