import { v7 as uuid, validate, version } from "uuid";
import { Identifier, Result, type ErrorOf } from "@architecture/foundation";

const UserIdentifierErrors = {
  empty: {
    kind: "user_identifier.empty",
  },
  invalidUuid: {
    kind: "user_identifier.invalid_uuid",
  },
  invalidVersion: (expected: number) => ({
    kind: "user_identifier.invalid_version",
    expected,
  }),
} as const;

export type UserIdentifierError = ErrorOf<typeof UserIdentifierErrors>;

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
      return Result.failure(UserIdentifierErrors.empty);
    }

    if (!validate(value)) {
      return Result.failure(UserIdentifierErrors.invalidUuid);
    }

    if (version(value) !== 7) {
      return Result.failure(UserIdentifierErrors.invalidVersion(7));
    }

    return Result.ok(
      new UserIdentifierValueObject({
        value,
      }),
    );
  }
}
