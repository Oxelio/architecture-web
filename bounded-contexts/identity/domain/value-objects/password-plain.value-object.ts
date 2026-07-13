// @file bounded-contexts/identity/domain/value-objects/password-plain.value-object.ts

import { Result, ValueObject, type ErrorOf } from "@architecture/foundation";

const PlainPasswordErrors = {
  empty: {
    code: "password.empty",
  },

  tooShort: (actual: number, min: number) => ({
    code: "password.too_short",
    actual,
    min,
  }),

  tooLong: (actual: number, max: number) => ({
    code: "password.too_long",
    actual,
    max,
  }),

  invalidFormat: (value: string) => ({
    code: "password.invalid_format",
    value,
  }),
} as const;

export type PlainPasswordError = ErrorOf<typeof PlainPasswordErrors>;

export class PasswordPlainValueObject extends ValueObject<{ value: string }> {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 32;

  get value(): string {
    return this.properties.value;
  }

  public static create(
    password: string,
  ): Result<PasswordPlainValueObject, PlainPasswordError> {
    if (!password) {
      return Result.failure(PlainPasswordErrors.empty);
    }

    if (PasswordPlainValueObject.isTooShort(password)) {
      return Result.failure(
        PlainPasswordErrors.tooShort(
          password.length,
          PasswordPlainValueObject.MIN_LENGTH,
        ),
      );
    }

    if (PasswordPlainValueObject.isTooLong(password)) {
      return Result.failure(
        PlainPasswordErrors.tooLong(
          password.length,
          PasswordPlainValueObject.MAX_LENGTH,
        ),
      );
    }

    if (PasswordPlainValueObject.isInvalidFormat(password)) {
      return Result.failure(PlainPasswordErrors.invalidFormat(password));
    }

    return Result.ok(new PasswordPlainValueObject({ value: password }));
  }

  private static isTooShort(password: string): boolean {
    return password.length < this.MIN_LENGTH;
  }

  private static isTooLong(password: string): boolean {
    return password.length > this.MAX_LENGTH;
  }

  private static isInvalidFormat(password: string): boolean {
    return !/^[a-zA-Z0-9!@#$%^&*()_+~`\-={}[\]|;:,.<>/?]{8,32}$/.test(password);
  }
}
