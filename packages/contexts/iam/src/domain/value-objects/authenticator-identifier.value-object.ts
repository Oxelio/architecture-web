import { Identifier, Result, type ValueOf } from "@architecture/foundation";
import { v7 as generateUuidV7, validate, version } from "uuid";

const errors = {
  empty: { code: "authenticator_identifier.empty" },
  invalidUuid: { code: "authenticator_identifier.invalid_uuid" },
  invalidVersion: {
    code: "authenticator_identifier.invalid_version",
    expected: 7,
  },
} as const;

export type AuthenticatorIdentifierError = ValueOf<typeof errors>;

export class AuthenticatorIdentifierValueObject extends Identifier {
  static generate(): AuthenticatorIdentifierValueObject {
    return new AuthenticatorIdentifierValueObject({ value: generateUuidV7() });
  }

  static create(
    value: string,
  ): Result<AuthenticatorIdentifierValueObject, AuthenticatorIdentifierError> {
    if (!value) {
      return Result.failure(errors.empty);
    }
    if (!validate(value)) {
      return Result.failure(errors.invalidUuid);
    }
    if (version(value) !== 7) {
      return Result.failure(errors.invalidVersion);
    }
    return Result.success(new AuthenticatorIdentifierValueObject({ value }));
  }
}
