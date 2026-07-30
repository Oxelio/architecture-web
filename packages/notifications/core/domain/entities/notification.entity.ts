import { AggregateRoot } from "@architecture/foundation";

import { NotificationDeliveryEntity } from "#entities/notification-delivery.entity";
import {
  type NotificationChannelType,
  NotificationChannelValueObject,
} from "#value-objects/notification-channel.value-object";
import {
  NotificationDeliveryIdentifierValueObject,
  NotificationIdentifierValueObject,
} from "#value-objects/notification-identifier.value-object";
import type { NotificationSeverityValueObject } from "#value-objects/notification-severity.value-object";

export interface RehydratedNotificationProperties {
  readonly identifier: NotificationIdentifierValueObject;
  readonly recipientId: string;
  readonly sourceEventId: string;
  readonly type: string;
  readonly severity: NotificationSeverityValueObject;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
  readAt: Date | null;
  archivedAt: Date | null;
  readonly deliveries: readonly NotificationDeliveryEntity[];
}

export interface CreateNotificationProperties {
  readonly recipientId: string;
  readonly sourceEventId: string;
  readonly type: string;
  readonly severity: NotificationSeverityValueObject;
  readonly title: string;
  readonly message: string;
  readonly actionUrl?: string;
  readonly deliveries: readonly {
    readonly channel: NotificationChannelType;
    readonly destination: string;
  }[];
}

export class NotificationEntity extends AggregateRoot<RehydratedNotificationProperties> {
  static create(
    properties: CreateNotificationProperties,
    now = new Date(),
  ): NotificationEntity {
    const deliveries = properties.deliveries.map((delivery) => {
      const channel = NotificationChannelValueObject.create(delivery.channel);
      if (!channel.success) {
        throw new Error(
          `Unsupported notification channel: ${delivery.channel}`,
        );
      }
      return NotificationDeliveryEntity.create(
        {
          identifier: NotificationDeliveryIdentifierValueObject.generate(),
          channel: channel.value,
          destination: delivery.destination,
        },
        now,
      );
    });
    return NotificationEntity.rehydrate({
      identifier: NotificationIdentifierValueObject.generate(),
      recipientId: properties.recipientId,
      sourceEventId: properties.sourceEventId,
      type: properties.type,
      severity: properties.severity,
      title: properties.title,
      message: properties.message,
      actionUrl: properties.actionUrl ?? null,
      createdAt: now,
      readAt: null,
      archivedAt: null,
      deliveries,
    });
  }

  static rehydrate(
    properties: RehydratedNotificationProperties,
  ): NotificationEntity {
    for (const value of [
      properties.recipientId,
      properties.sourceEventId,
      properties.type,
      properties.title,
      properties.message,
    ]) {
      if (!value.trim()) {
        throw new Error("Notification business fields cannot be empty");
      }
    }
    if (Number.isNaN(properties.createdAt.getTime())) {
      throw new Error("A notification requires a valid creation date");
    }
    return new NotificationEntity(properties);
  }

  get recipientId(): string {
    return this.props.recipientId;
  }

  get sourceEventId(): string {
    return this.props.sourceEventId;
  }

  get type(): string {
    return this.props.type;
  }

  get severity(): NotificationSeverityValueObject {
    return this.props.severity;
  }

  get title(): string {
    return this.props.title;
  }

  get message(): string {
    return this.props.message;
  }

  get actionUrl(): string | null {
    return this.props.actionUrl;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get readAt(): Date | null {
    return this.props.readAt;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get deliveries(): readonly NotificationDeliveryEntity[] {
    return this.props.deliveries;
  }

  markRead(now = new Date()): boolean {
    if (this.props.readAt) {
      return false;
    }
    this.props.readAt = now;
    return true;
  }

  archive(now = new Date()): void {
    this.props.archivedAt = now;
  }
}
