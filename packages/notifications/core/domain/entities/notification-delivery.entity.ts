import { Entity } from "@architecture/foundation";

import type { NotificationChannelValueObject } from "#value-objects/notification-channel.value-object";
import type { NotificationDeliveryIdentifierValueObject } from "#value-objects/notification-identifier.value-object";

export type NotificationDeliveryStatus =
  "pending" | "processing" | "sent" | "failed" | "dead_letter";

interface NotificationDeliveryProperties {
  readonly identifier: NotificationDeliveryIdentifierValueObject;
  readonly channel: NotificationChannelValueObject;
  readonly destination: string;
  status: NotificationDeliveryStatus;
  attempts: number;
  availableAt: Date;
  claimedAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
}

const MAX_DELIVERY_ATTEMPTS = 10;
const MAX_RETRY_DELAY_MS = 60_000;

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

  claim(now = new Date()): boolean {
    if (
      !["pending", "failed"].includes(this.props.status) ||
      this.props.availableAt.getTime() > now.getTime()
    ) {
      return false;
    }
    this.props.status = "processing";
    this.props.claimedAt = now;
    return true;
  }

  markSent(now = new Date()): void {
    if (this.props.status !== "processing") {
      throw new Error("Only a claimed notification delivery can be sent");
    }
    this.props.status = "sent";
    this.props.sentAt = now;
    this.props.claimedAt = null;
    this.props.lastError = null;
  }

  markFailed(error: unknown, now = new Date()): void {
    if (this.props.status !== "processing") {
      throw new Error("Only a claimed notification delivery can fail");
    }
    this.props.attempts += 1;
    this.props.status =
      this.props.attempts >= MAX_DELIVERY_ATTEMPTS ? "dead_letter" : "failed";
    this.props.availableAt = new Date(
      now.getTime() +
        Math.min(
          MAX_RETRY_DELAY_MS,
          2 ** Math.min(this.props.attempts, MAX_DELIVERY_ATTEMPTS) * 1_000,
        ),
    );
    this.props.claimedAt = null;
    this.props.lastError = String(error).slice(0, 2_000);
  }
}
