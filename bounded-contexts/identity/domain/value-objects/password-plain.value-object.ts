import { Result, ValueObject } from "@architecture/foundation";

export type PlainPasswordError =
  | { readonly kind: "password.empty" }
  | {
      readonly kind: "password.too_short";
      readonly min: number;
      readonly actual: number;
    }
  | {
      readonly kind: "password.too_long";
      readonly max: number;
      readonly actual: number;
    }
  | { readonly kind: "password.invalid_format"; readonly value: string };

const PlainPasswordError = {
  empty: (): PlainPasswordError => ({
    kind: "password.empty",
  }),

  tooShort: (actual: number, min: number): PlainPasswordError => ({
    kind: "password.too_short",
    actual,
    min,
  }),

  tooLong: (actual: number, max: number): PlainPasswordError => ({
    kind: "password.too_long",
    actual,
    max,
  }),

  invalidFormat: (value: string): PlainPasswordError => ({
    kind: "password.invalid_format",
    value,
  }),
} as const;

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
      return Result.failure(PlainPasswordError.empty());
    }

    if (PasswordPlainValueObject.isTooShort(password)) {
      return Result.failure(
        PlainPasswordError.tooShort(
          password.length,
          PasswordPlainValueObject.MIN_LENGTH,
        ),
      );
    }

    if (PasswordPlainValueObject.isTooLong(password)) {
      return Result.failure(
        PlainPasswordError.tooLong(
          password.length,
          PasswordPlainValueObject.MAX_LENGTH,
        ),
      );
    }

    if (PasswordPlainValueObject.isInvalidFormat(password)) {
      return Result.failure(PlainPasswordError.invalidFormat(password));
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
