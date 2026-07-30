import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

export const notificationSeverities = [
  "information",
  "warning",
  "critical",
] as const;
export type NotificationSeverity = (typeof notificationSeverities)[number];

const errors = {
  invalid: (value: string) => ({
    code: "notification.severity.invalid",
    value,
  }),
} as const;

export type NotificationSeverityError = ValueOf<typeof errors>;

export class NotificationSeverityValueObject extends ValueObject<{
  readonly value: NotificationSeverity;
}> {
  get value(): NotificationSeverity {
    return this.properties.value;
  }

  static create(
    value: string,
  ): Result<NotificationSeverityValueObject, NotificationSeverityError> {
    return notificationSeverities.includes(value as NotificationSeverity)
      ? Result.success(
          new NotificationSeverityValueObject({
            value: value as NotificationSeverity,
          }),
        )
      : Result.failure(errors.invalid(value));
  }
}
