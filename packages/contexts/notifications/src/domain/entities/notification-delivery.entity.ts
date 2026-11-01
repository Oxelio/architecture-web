import { Entity } from "@architecture/foundation";

import type { NotificationChannelValueObject } from "#domain/value-objects/notification-channel.value-object";
import type { NotificationDeliveryIdentifierValueObject } from "#domain/value-objects/notification-identifier.value-object";

export type NotificationDeliveryStatus =
  "pending" | "processing" | "sent" | "failed" | "dead_letter" | "suppressed";

export type NotificationDeliveryAudience =
  "affected_user" | "administrator" | "affected_user_and_administrator";
export type NotificationSuppressionReason = "administrator_not_authorized";

interface NotificationDeliveryProperties {
  readonly identifier: NotificationDeliveryIdentifierValueObject;
  readonly channel: NotificationChannelValueObject;
  readonly destination: string;
  readonly audience: NotificationDeliveryAudience;
  suppressionReason: NotificationSuppressionReason | null;
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
      "identifier" | "channel" | "destination" | "audience"
    >,
    now = new Date(),
  ): NotificationDeliveryEntity {
    return NotificationDeliveryEntity.rehydrate({
      ...properties,
      suppressionReason: null,
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
    if (
      ![
        "affected_user",
        "administrator",
        "affected_user_and_administrator",
      ].includes(properties.audience)
    ) {
      throw new Error("Invalid notification delivery audience");
    }
    if (
      ![
        "pending",
        "processing",
        "sent",
        "failed",
        "dead_letter",
        "suppressed",
      ].includes(properties.status) ||
      (properties.status === "suppressed"
        ? properties.suppressionReason !== "administrator_not_authorized"
        : properties.suppressionReason !== null)
    ) {
      throw new Error("Invalid notification delivery state");
    }
    if (!properties.destination.trim()) {
      throw new Error("A notification delivery requires a destination");
    }
    if (!Number.isSafeInteger(properties.attempts) || properties.attempts < 0) {
      throw new Error("Delivery attempts must be a non-negative integer");
    }
    return new NotificationDeliveryEntity(properties);
  }

  get channel(): NotificationChannelValueObject {
    return this.properties.channel;
  }

  get destination(): string {
    return this.properties.destination;
  }

  get audience(): NotificationDeliveryAudience {
    return this.properties.audience;
  }

  get suppressionReason(): NotificationSuppressionReason | null {
    return this.properties.suppressionReason;
  }

  suppress(reason: NotificationSuppressionReason): void {
    if (this.properties.status !== "processing") {
      throw new Error("Only a claimed notification delivery can be suppressed");
    }
    this.properties.status = "suppressed";
    this.properties.suppressionReason = reason;
    this.properties.claimedAt = null;
    this.properties.lastError = null;
  }

  get status(): NotificationDeliveryStatus {
    return this.properties.status;
  }

  get attempts(): number {
    return this.properties.attempts;
  }

  get availableAt(): Date {
    return this.properties.availableAt;
  }

  get claimedAt(): Date | null {
    return this.properties.claimedAt;
  }

  get sentAt(): Date | null {
    return this.properties.sentAt;
  }

  get lastError(): string | null {
    return this.properties.lastError;
  }

  claim(now = new Date()): boolean {
    if (
      !["pending", "failed"].includes(this.properties.status) ||
      this.properties.attempts >= MAX_DELIVERY_ATTEMPTS ||
      this.properties.availableAt.getTime() > now.getTime()
    ) {
      return false;
    }
    this.properties.status = "processing";
    this.properties.attempts += 1;
    this.properties.claimedAt = now;
    return true;
  }

  markSent(now = new Date()): void {
    if (this.properties.status !== "processing") {
      throw new Error("Only a claimed notification delivery can be sent");
    }
    this.properties.status = "sent";
    this.properties.sentAt = now;
    this.properties.claimedAt = null;
    this.properties.lastError = null;
  }

  markFailed(error: unknown, now = new Date()): void {
    if (this.properties.status !== "processing") {
      throw new Error("Only a claimed notification delivery can fail");
    }
    this.properties.status =
      this.properties.attempts >= MAX_DELIVERY_ATTEMPTS
        ? "dead_letter"
        : "failed";
    this.properties.availableAt = new Date(
      now.getTime() +
        Math.min(
          MAX_RETRY_DELAY_MS,
          2 ** Math.min(this.properties.attempts, MAX_DELIVERY_ATTEMPTS) *
            1_000,
        ),
    );
    this.properties.claimedAt = null;
    this.properties.lastError = String(error).slice(0, 2_000);
  }
}
