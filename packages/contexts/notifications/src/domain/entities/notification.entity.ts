import { AggregateRoot } from "@architecture/foundation";

import { NotificationDeliveryEntity } from "#domain/entities/notification-delivery.entity";
import {
  type NotificationChannelType,
  NotificationChannelValueObject,
} from "#domain/value-objects/notification-channel.value-object";
import {
  NotificationDeliveryIdentifierValueObject,
  NotificationIdentifierValueObject,
} from "#domain/value-objects/notification-identifier.value-object";
import type { NotificationSeverityValueObject } from "#domain/value-objects/notification-severity.value-object";

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
      throw new TypeError("A notification requires a valid creation date");
    }
    return new NotificationEntity(properties);
  }

  get recipientId(): string {
    return this.properties.recipientId;
  }

  get sourceEventId(): string {
    return this.properties.sourceEventId;
  }

  get type(): string {
    return this.properties.type;
  }

  get severity(): NotificationSeverityValueObject {
    return this.properties.severity;
  }

  get title(): string {
    return this.properties.title;
  }

  get message(): string {
    return this.properties.message;
  }

  get actionUrl(): string | null {
    return this.properties.actionUrl;
  }

  get createdAt(): Date {
    return this.properties.createdAt;
  }

  get readAt(): Date | null {
    return this.properties.readAt;
  }

  get archivedAt(): Date | null {
    return this.properties.archivedAt;
  }

  get deliveries(): readonly NotificationDeliveryEntity[] {
    return this.properties.deliveries;
  }

  markRead(now = new Date()): boolean {
    if (this.properties.readAt) {
      return false;
    }
    this.properties.readAt = now;
    return true;
  }

  archive(now = new Date()): void {
    this.properties.archivedAt = now;
  }
}
