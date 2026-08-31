import { randomUUID } from "node:crypto";

import { Identifier, Result, type ValueOf } from "@architecture/foundation";

const errors = {
  notificationEmpty: { code: "notification.identifier.empty" },
  deliveryEmpty: { code: "notification.delivery_identifier.empty" },
} as const;

export type NotificationIdentifierError = ValueOf<typeof errors>;

export class NotificationIdentifierValueObject extends Identifier {
  static generate(): NotificationIdentifierValueObject {
    return new NotificationIdentifierValueObject({ value: randomUUID() });
  }

  static create(
    value: string,
  ): Result<NotificationIdentifierValueObject, NotificationIdentifierError> {
    return value
      ? Result.success(new NotificationIdentifierValueObject({ value }))
      : Result.failure(errors.notificationEmpty);
  }
}

export class NotificationDeliveryIdentifierValueObject extends Identifier {
  static generate(): NotificationDeliveryIdentifierValueObject {
    return new NotificationDeliveryIdentifierValueObject({
      value: randomUUID(),
    });
  }

  static create(
    value: string,
  ): Result<
    NotificationDeliveryIdentifierValueObject,
    NotificationIdentifierError
  > {
    return value
      ? Result.success(new NotificationDeliveryIdentifierValueObject({ value }))
      : Result.failure(errors.deliveryEmpty);
  }
}
