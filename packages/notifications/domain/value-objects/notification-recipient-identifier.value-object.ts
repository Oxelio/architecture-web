import { Identifier, Result, type ValueOf } from "@architecture/foundation";

const NotificationRecipientIdentifierErrors = {
  empty: { code: "notification.recipient_identifier.empty" },
} as const;

export type NotificationRecipientIdentifierError = ValueOf<
  typeof NotificationRecipientIdentifierErrors
>;

export class NotificationRecipientIdentifierValueObject extends Identifier {
  static create(
    value: string,
  ): Result<
    NotificationRecipientIdentifierValueObject,
    NotificationRecipientIdentifierError
  > {
    if (!value.trim()) {
      return Result.failure(NotificationRecipientIdentifierErrors.empty);
    }
    return Result.success(
      new NotificationRecipientIdentifierValueObject({ value }),
    );
  }
}
