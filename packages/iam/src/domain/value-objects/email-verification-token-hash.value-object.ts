import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

const EmailVerificationTokenHashErrors = {
  empty: { code: "email_verification_token_hash.empty" },
  invalidFormat: { code: "email_verification_token_hash.invalid_format" },
} as const;

export type EmailVerificationTokenHashError = ValueOf<
  typeof EmailVerificationTokenHashErrors
>;

export class EmailVerificationTokenHashValueObject extends ValueObject<{
  value: string;
}> {
  public get value(): string {
    return this.properties.value;
  }

  public static create(
    value: string,
  ): Result<
    EmailVerificationTokenHashValueObject,
    EmailVerificationTokenHashError
  > {
    if (!value) {
      return Result.failure(EmailVerificationTokenHashErrors.empty);
    }

    if (!/^[a-f0-9]{64}$/.test(value)) {
      return Result.failure(EmailVerificationTokenHashErrors.invalidFormat);
    }

    return Result.success(new EmailVerificationTokenHashValueObject({ value }));
  }
}
