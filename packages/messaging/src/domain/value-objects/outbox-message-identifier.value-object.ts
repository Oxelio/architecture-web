import { Identifier, Result, type ValueOf } from "@architecture/foundation";

const errors = {
  empty: { code: "outbox.identifier.empty" },
} as const;

export type OutboxMessageIdentifierError = ValueOf<typeof errors>;

export class OutboxMessageIdentifierValueObject extends Identifier {
  static create(
    value: string,
  ): Result<OutboxMessageIdentifierValueObject, OutboxMessageIdentifierError> {
    return value
      ? Result.success(new OutboxMessageIdentifierValueObject({ value }))
      : Result.failure(errors.empty);
  }
}
