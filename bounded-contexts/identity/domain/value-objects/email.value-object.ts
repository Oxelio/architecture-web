// bounded-contexts/identity/domain/value-objects/email.value-object.ts

import { Result, ValueObject } from "@architecture/foundation";

export type EmailError =
  | { readonly kind: "email.empty" }
  | { readonly kind: "email.too_long"; readonly max: number }
  | { readonly kind: "email.invalid_format"; readonly value: string };

const EmailErrorFactory = {
  empty: (): EmailError => ({ kind: "email.empty" }),
  tooLong: (max: number): EmailError => ({ kind: "email.too_long", max }),
  invalidFormat: (value: string): EmailError => ({
    kind: "email.invalid_format",
    value,
  }),
} as const;

export class EmailValueObject extends ValueObject<{ value: string }> {
  private static readonly MAX_LENGTH = 254;
  private static readonly REGEX =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  public get value(): string {
    return this.properties.value;
  }

  public static create(email: string): Result<EmailValueObject, EmailError> {
    if (email.trim().length === 0) {
      return Result.failure(EmailErrorFactory.empty());
    }

    const normalized = this.normalize(email);

    if (this.isTooLong(normalized)) {
      return Result.failure(
        EmailErrorFactory.tooLong(EmailValueObject.MAX_LENGTH),
      );
    }

    if (this.isInvalidFormat(normalized)) {
      return Result.failure(EmailErrorFactory.invalidFormat(normalized));
    }

    return Result.ok(new EmailValueObject({ value: normalized }));
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
