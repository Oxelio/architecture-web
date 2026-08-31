import { Entity } from "@architecture/foundation";

import type { NotificationChannelType } from "#value-objects/notification-channel.value-object";
import type { NotificationRecipientIdentifierValueObject } from "#value-objects/notification-recipient-identifier.value-object";

interface NotificationRecipientProperties {
  readonly identifier: NotificationRecipientIdentifierValueObject;
  readonly email: string | null;
  readonly phoneNumber: string | null;
}

export class NotificationRecipientEntity extends Entity<NotificationRecipientProperties> {
  static create(
    properties: NotificationRecipientProperties,
  ): NotificationRecipientEntity {
    const email = properties.email?.trim() || null;
    const phoneNumber = properties.phoneNumber?.trim() || null;
    return new NotificationRecipientEntity({
      ...properties,
      email,
      phoneNumber,
    });
  }

  get userId(): string {
    return this.identifier.value;
  }

  destinationFor(channel: NotificationChannelType): string | null {
    if (channel === "email") {
      return this.properties.email;
    }
    if (channel === "sms") {
      return this.properties.phoneNumber;
    }
    return null;
  }
}
