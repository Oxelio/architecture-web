import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

import { EmailValueObject } from "#value-objects/email.value-object";

export const LoginIdentifierKinds = {
  username: "username",
  email: "email",
} as const;

export type LoginIdentifierKind = ValueOf<typeof LoginIdentifierKinds>;

const errors = {
  empty: { code: "login_identifier.empty" },
  invalidKind: { code: "login_identifier.invalid_kind" },
  invalidEmail: { code: "login_identifier.invalid_email" },
  invalidUsername: { code: "login_identifier.invalid_username" },
} as const;

export type LoginIdentifierError = ValueOf<typeof errors>;

interface LoginIdentifierProperties {
  readonly kind: LoginIdentifierKind;
  readonly value: string;
}

export class LoginIdentifierValueObject extends ValueObject<LoginIdentifierProperties> {
  get kind(): LoginIdentifierKind {
    return this.properties.kind;
  }

  get value(): string {
    return this.properties.value;
  }

  get key(): string {
    return `${this.kind}:${this.value}`;
  }

  static create(
    kind: LoginIdentifierKind,
    input: string,
  ): Result<LoginIdentifierValueObject, LoginIdentifierError> {
    if (!input.trim()) {
      return Result.failure(errors.empty);
    }

    if (kind === LoginIdentifierKinds.email) {
      const email = EmailValueObject.create(input);
      return email.success
        ? Result.success(
            new LoginIdentifierValueObject({
              kind,
              value: email.value.value,
            }),
          )
        : Result.failure(errors.invalidEmail);
    }

    if (kind === LoginIdentifierKinds.username) {
      const value = input.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(value)) {
        return Result.failure(errors.invalidUsername);
      }
      return Result.success(new LoginIdentifierValueObject({ kind, value }));
    }

    return Result.failure(errors.invalidKind);
  }
}
