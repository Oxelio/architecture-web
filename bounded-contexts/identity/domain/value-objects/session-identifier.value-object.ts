import { v7 as uuid, validate, version } from "uuid";
import { Identifier, Result } from "@architecture/foundation";

export type SessionIdentifierError =
  | { readonly kind: "session_identifier.empty" }
  | { readonly kind: "session_identifier.invalid_uuid" }
  | {
      readonly kind: "session_identifier.invalid_version";
      readonly expected: 7;
    };

const SessionIdentifierError = {
  empty: (): SessionIdentifierError => ({
    kind: "session_identifier.empty",
  }),

  invalidUuid: (): SessionIdentifierError => ({
    kind: "session_identifier.invalid_uuid",
  }),

  invalidVersion: (): SessionIdentifierError => ({
    kind: "session_identifier.invalid_version",
    expected: 7,
  }),
} as const;

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
      return Result.failure(SessionIdentifierError.empty());
    }

    if (!validate(value)) {
      return Result.failure(SessionIdentifierError.invalidUuid());
    }

    if (version(value) !== 7) {
      return Result.failure(SessionIdentifierError.invalidVersion());
    }

    return Result.ok(
      new SessionIdentifierValueObject({
        value,
      }),
    );
  }
}
