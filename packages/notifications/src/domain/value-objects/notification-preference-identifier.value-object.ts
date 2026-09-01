import { Identifier, Result, type ValueOf } from "@architecture/foundation";

const NotificationPreferenceIdentifierErrors = {
  empty: { code: "notification.preference_identifier.empty" },
} as const;

export type NotificationPreferenceIdentifierError = ValueOf<
  typeof NotificationPreferenceIdentifierErrors
>;

export class NotificationPreferenceIdentifierValueObject extends Identifier {
  static create(
    recipientId: string,
    channel: string,
  ): Result<
    NotificationPreferenceIdentifierValueObject,
    NotificationPreferenceIdentifierError
  > {
    if (!recipientId.trim() || !channel.trim()) {
      return Result.failure(NotificationPreferenceIdentifierErrors.empty);
    }
    return Result.success(
      new NotificationPreferenceIdentifierValueObject({
        value: `${recipientId}:${channel}`,
      }),
    );
  }
}
