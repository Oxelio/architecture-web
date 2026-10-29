import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const PlainPasswordErrors = {
  empty: {
    code: "password.empty",
  },

  tooLong: (actual: number, max: number) =>
    ({
      code: "password.too_long",
      actual,
      max,
    }) as const,
} as const;

export type PlainPasswordError = ValueOf<typeof PlainPasswordErrors>;

export class PasswordPlainValueObject extends ValueObject<{ value: string }> {
  /**
   * Defensive transport bound, not the password policy maximum.
   * Keeping this value object permissive preserves authentication for passwords
   * created before the active policy was introduced.
   */
  private static readonly MAX_LENGTH = 1024;

  get value(): string {
    return this.properties.value;
  }

  public static create(
    password: string,
  ): Result<PasswordPlainValueObject, PlainPasswordError> {
    if (!password) {
      return Result.failure(PlainPasswordErrors.empty);
    }

    if (PasswordPlainValueObject.isTooLong(password)) {
      return Result.failure(
        PlainPasswordErrors.tooLong(
          PasswordPlainValueObject.codePointLength(password),
          PasswordPlainValueObject.MAX_LENGTH,
        ),
      );
    }

    return Result.success(new PasswordPlainValueObject({ value: password }));
  }

  private static codePointLength(password: string): number {
    return [...password].length;
  }

  private static isTooLong(password: string): boolean {
    return this.codePointLength(password) > this.MAX_LENGTH;
  }
}
