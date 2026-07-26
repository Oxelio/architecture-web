// @file bounded-contexts/identity/domain/value-objects/email.value-object.ts

import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const EmailErrors = {
  empty: {
    code: "email.empty",
  },

  tooLong: (max: number) =>
    ({
      code: "email.too_long",
      max,
    }) as const,

  invalidFormat: (value: string) =>
    ({
      code: "email.invalid_format",
      value,
    }) as const,
} as const;

export type EmailError = ValueOf<typeof EmailErrors>;

export class EmailValueObject extends ValueObject<{ value: string }> {
  private static readonly MAX_LENGTH = 254;
  private static readonly REGEX =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  public get value(): string {
    return this.properties.value;
  }

  public static create(email: string): Result<EmailValueObject, EmailError> {
    if (email.trim().length === 0) {
      return Result.failure(EmailErrors.empty);
    }

    const normalized = this.normalize(email);

    if (this.isTooLong(normalized)) {
      return Result.failure(EmailErrors.tooLong(EmailValueObject.MAX_LENGTH));
    }

    if (this.isInvalidFormat(normalized)) {
      return Result.failure(EmailErrors.invalidFormat(normalized));
    }

    return Result.success(new EmailValueObject({ value: normalized }));
  }

  private static normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  private static isTooLong(email: string): boolean {
    return email.length > this.MAX_LENGTH;
  }

  private static isInvalidFormat(email: string): boolean {
    return !this.REGEX.test(email);
  }
}
