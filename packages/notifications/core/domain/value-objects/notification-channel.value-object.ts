import { Result, ValueObject, type ValueOf } from "@architecture/foundation";

export const notificationChannels = ["email", "slack", "sms"] as const;
export type NotificationChannelType = (typeof notificationChannels)[number];

const errors = {
  invalid: (value: string) => ({ code: "notification.channel.invalid", value }),
} as const;

export type NotificationChannelError = ValueOf<typeof errors>;

export class NotificationChannelValueObject extends ValueObject<{
  readonly value: NotificationChannelType;
}> {
  get value(): NotificationChannelType {
    return this.properties.value;
  }

  static create(
    value: string,
  ): Result<NotificationChannelValueObject, NotificationChannelError> {
    return notificationChannels.includes(value as NotificationChannelType)
      ? Result.success(
          new NotificationChannelValueObject({
            value: value as NotificationChannelType,
          }),
        )
      : Result.failure(errors.invalid(value));
  }
}
