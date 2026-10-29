import { Result, ValueObject, type ValueOf } from "@architecture/foundation";
import { v4 as uuid, validate, version } from "uuid";

const EmailVerificationTokenErrors = {
  empty: {
    code: "email_verification_token.empty",
  },
  invalidUuid: {
    code: "email_verification_token.invalid_uuid",
  },
  invalidVersion: (expected: number) =>
    ({
      code: "email_verification_token.invalid_version",
      expected,
    }) as const,
} as const;

export type EmailVerificationTokenError = ValueOf<
  typeof EmailVerificationTokenErrors
>;

export class EmailVerificationTokenValueObject extends ValueObject<{
  value: string;
}> {
  public get value(): string {
    return this.properties.value;
  }

  public static generate(): EmailVerificationTokenValueObject {
    return new EmailVerificationTokenValueObject({ value: uuid() });
  }

  public static create(
    value: string,
  ): Result<EmailVerificationTokenValueObject, EmailVerificationTokenError> {
    if (!value) {
      return Result.failure(EmailVerificationTokenErrors.empty);
    }

    if (!validate(value)) {
      return Result.failure(EmailVerificationTokenErrors.invalidUuid);
    }

    if (version(value) !== 4) {
      return Result.failure(EmailVerificationTokenErrors.invalidVersion(4));
    }

    return Result.success(new EmailVerificationTokenValueObject({ value }));
  }
}
