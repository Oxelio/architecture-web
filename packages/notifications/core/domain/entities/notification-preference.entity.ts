import { AggregateRoot } from "@architecture/foundation";

import type { NotificationChannelValueObject } from "#value-objects/notification-channel.value-object";
import { NotificationPreferenceIdentifierValueObject } from "#value-objects/notification-preference-identifier.value-object";

interface NotificationPreferenceProperties {
  readonly identifier: NotificationPreferenceIdentifierValueObject;
  readonly recipientId: string;
  readonly channel: NotificationChannelValueObject;
  enabled: boolean;
  updatedAt: Date;
}

export interface RehydratedNotificationPreferenceProperties {
  readonly recipientId: string;
  readonly channel: NotificationChannelValueObject;
  readonly enabled: boolean;
  readonly updatedAt: Date;
}

export class NotificationPreferenceEntity extends AggregateRoot<NotificationPreferenceProperties> {
  static create(
    recipientId: string,
    channel: NotificationChannelValueObject,
    enabled: boolean,
    now = new Date(),
  ): NotificationPreferenceEntity {
    return NotificationPreferenceEntity.rehydrate({
      recipientId,
      channel,
      enabled,
      updatedAt: now,
    });
  }

  static rehydrate(
    properties: RehydratedNotificationPreferenceProperties,
  ): NotificationPreferenceEntity {
    const identifier = NotificationPreferenceIdentifierValueObject.create(
      properties.recipientId,
      properties.channel.value,
    );
    if (!identifier.success) {
      throw new Error("A notification preference requires a recipient");
    }
    if (Number.isNaN(properties.updatedAt.getTime())) {
      throw new Error("A notification preference requires a valid update date");
    }
    return new NotificationPreferenceEntity({
      identifier: identifier.value,
      ...properties,
    });
  }

  get recipientId(): string {
    return this.props.recipientId;
  }

  get channel(): NotificationChannelValueObject {
    return this.props.channel;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(enabled: boolean, now = new Date()): boolean {
    if (this.props.enabled === enabled) {
      return false;
    }
    this.props.enabled = enabled;
    this.props.updatedAt = now;
    return true;
  }
}
