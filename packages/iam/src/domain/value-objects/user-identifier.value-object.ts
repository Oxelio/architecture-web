// @file bounded-contexts/iam/domain/value-objects/user-identifier.value-object.ts

import { Identifier, Result, type ValueOf } from "@architecture/foundation";
import { v7 as uuid, validate, version } from "uuid";

const UserIdentifierErrors = {
  empty: {
    code: "user_identifier.empty",
  },
  invalidUuid: {
    code: "user_identifier.invalid_uuid",
  },
  invalidVersion: (expected: number) =>
    ({
      code: "user_identifier.invalid_version",
      expected,
    }) as const,
} as const;

export type UserIdentifierError = ValueOf<typeof UserIdentifierErrors>;

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

    return Result.success(
      new UserIdentifierValueObject({
        value,
      }),
    );
  }
}
