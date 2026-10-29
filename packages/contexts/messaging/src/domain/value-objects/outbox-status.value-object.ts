import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

export const outboxStatuses = [
  "pending",
  "processing",
  "published",
  "failed",
  "dead_letter",
] as const;

export type OutboxStatus = (typeof outboxStatuses)[number];

const errors = {
  invalid: (value: string) => ({ code: "outbox.status.invalid", value }),
} as const;

export type OutboxStatusError = ValueOf<typeof errors>;

export class OutboxStatusValueObject extends ValueObject<{
  readonly value: OutboxStatus;
}> {
  get value(): OutboxStatus {
    return this.properties.value;
  }

  static create(
    value: string,
  ): Result<OutboxStatusValueObject, OutboxStatusError> {
    return outboxStatuses.includes(value as OutboxStatus)
      ? Result.success(
          new OutboxStatusValueObject({ value: value as OutboxStatus }),
        )
      : Result.failure(errors.invalid(value));
  }

  static pending(): OutboxStatusValueObject {
    return new OutboxStatusValueObject({ value: "pending" });
  }

  static processing(): OutboxStatusValueObject {
    return new OutboxStatusValueObject({ value: "processing" });
  }

  static published(): OutboxStatusValueObject {
    return new OutboxStatusValueObject({ value: "published" });
  }

  static failed(): OutboxStatusValueObject {
    return new OutboxStatusValueObject({ value: "failed" });
  }

  static deadLetter(): OutboxStatusValueObject {
    return new OutboxStatusValueObject({ value: "dead_letter" });
  }
}
