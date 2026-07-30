import { Entity } from "@architecture/foundation";

import type { NotificationChannelValueObject } from "#value-objects/notification-channel.value-object";
import type { NotificationDeliveryIdentifierValueObject } from "#value-objects/notification-identifier.value-object";

export type NotificationDeliveryStatus =
  "pending" | "processing" | "sent" | "failed" | "dead_letter";

interface NotificationDeliveryProperties {
  readonly identifier: NotificationDeliveryIdentifierValueObject;
  readonly channel: NotificationChannelValueObject;
  readonly destination: string;
  readonly status: NotificationDeliveryStatus;
  readonly attempts: number;
  readonly availableAt: Date;
  readonly claimedAt: Date | null;
  readonly sentAt: Date | null;
  readonly lastError: string | null;
}

export class NotificationDeliveryEntity extends Entity<NotificationDeliveryProperties> {
  static create(
    properties: Pick<
      NotificationDeliveryProperties,
      "identifier" | "channel" | "destination"
    >,
    now = new Date(),
  ): NotificationDeliveryEntity {
    return NotificationDeliveryEntity.rehydrate({
      ...properties,
      status: "pending",
      attempts: 0,
      availableAt: now,
      claimedAt: null,
      sentAt: null,
      lastError: null,
    });
  }

  static rehydrate(
    properties: NotificationDeliveryProperties,
  ): NotificationDeliveryEntity {
    if (!properties.destination.trim()) {
      throw new Error("A notification delivery requires a destination");
    }
    if (!Number.isSafeInteger(properties.attempts) || properties.attempts < 0) {
      throw new Error("Delivery attempts must be a non-negative integer");
    }
    return new NotificationDeliveryEntity(properties);
  }

  get channel(): NotificationChannelValueObject {
    return this.props.channel;
  }

  get destination(): string {
    return this.props.destination;
  }

  get status(): NotificationDeliveryStatus {
    return this.props.status;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get availableAt(): Date {
    return this.props.availableAt;
  }

  get claimedAt(): Date | null {
    return this.props.claimedAt;
  }

  get sentAt(): Date | null {
    return this.props.sentAt;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }
}
