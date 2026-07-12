import { v7 as uuid, validate, version } from "uuid";
import { Identifier, Result, type ErrorOf } from "@architecture/foundation";

const SessionIdentifierErrors = {
  empty: {
    code: "session_identifier.empty",
  },
  invalidUuid: {
    code: "session_identifier.invalid_uuid",
  },
  invalidVersion: (expected: number) => ({
    code: "session_identifier.invalid_version",
    expected,
  }),
} as const;

export type SessionIdentifierError = ErrorOf<typeof SessionIdentifierErrors>;

export class SessionIdentifierValueObject extends Identifier {
  static generate(): SessionIdentifierValueObject {
    return new SessionIdentifierValueObject({
      value: uuid(),
    });
  }

  static create(
    value: string,
  ): Result<SessionIdentifierValueObject, SessionIdentifierError> {
    if (!value) {
      return Result.failure(SessionIdentifierErrors.empty);
    }

    if (!validate(value)) {
      return Result.failure(SessionIdentifierErrors.invalidUuid);
    }

    if (version(value) !== 7) {
      return Result.failure(SessionIdentifierErrors.invalidVersion(7));
    }

    return Result.ok(
      new SessionIdentifierValueObject({
        value,
      }),
    );
  }
}
