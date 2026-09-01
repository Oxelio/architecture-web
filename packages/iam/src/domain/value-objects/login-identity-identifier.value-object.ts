import { Identifier, Result, type ValueOf } from "@architecture/foundation";
import { v7 as generateUuidV7, validate, version } from "uuid";

const errors = {
  empty: { code: "login_identity_identifier.empty" },
  invalidUuid: { code: "login_identity_identifier.invalid_uuid" },
  invalidVersion: {
    code: "login_identity_identifier.invalid_version",
    expected: 7,
  },
} as const;

export type LoginIdentityIdentifierError = ValueOf<typeof errors>;

export class LoginIdentityIdentifierValueObject extends Identifier {
  static generate(): LoginIdentityIdentifierValueObject {
    return new LoginIdentityIdentifierValueObject({ value: generateUuidV7() });
  }

  static create(
    value: string,
  ): Result<LoginIdentityIdentifierValueObject, LoginIdentityIdentifierError> {
    if (!value) {
      return Result.failure(errors.empty);
    }
    if (!validate(value)) {
      return Result.failure(errors.invalidUuid);
    }
    if (version(value) !== 7) {
      return Result.failure(errors.invalidVersion);
    }
    return Result.success(new LoginIdentityIdentifierValueObject({ value }));
  }
}
