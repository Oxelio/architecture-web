import { v7 as uuid, validate, version } from "uuid";
import { Identifier, Result } from "@architecture/foundation";

type UserIdentifierError =
  | { readonly kind: "user_identifier.empty" }
  | { readonly kind: "user_identifier.invalid_uuid" }
  | { readonly kind: "user_identifier.invalid_version"; readonly expected: 7 };

const UserIdentifierError = {
  empty: (): UserIdentifierError => ({
    kind: "user_identifier.empty",
  }),

  invalidUuid: (): UserIdentifierError => ({
    kind: "user_identifier.invalid_uuid",
  }),

  invalidVersion: (): UserIdentifierError => ({
    kind: "user_identifier.invalid_version",
    expected: 7,
  }),
} as const;

export class UserIdentifierValueObject extends Identifier {
  public static generate(): UserIdentifierValueObject {
    return new UserIdentifierValueObject({
      value: uuid(),
    });
  }

  public static create(
    value: string,
  ): Result<UserIdentifierValueObject, UserIdentifierError> {
    if (!value) {
      return Result.failure(UserIdentifierError.empty());
    }

    if (!validate(value)) {
      return Result.failure(UserIdentifierError.invalidUuid());
    }

    if (version(value) !== 7) {
      return Result.failure(UserIdentifierError.invalidVersion());
    }

    return Result.ok(
      new UserIdentifierValueObject({
        value,
      }),
    );
  }
}
