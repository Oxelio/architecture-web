import { Entity } from "@architecture/foundation";

import type { IntegrationEvent } from "#domain/integration-event";
import { OutboxMessageIdentifierValueObject } from "#value-objects/outbox-message-identifier.value-object";
import {
  type OutboxStatus,
  OutboxStatusValueObject,
} from "#value-objects/outbox-status.value-object";

interface OutboxMessageProperties {
  readonly identifier: OutboxMessageIdentifierValueObject;
  readonly event: IntegrationEvent;
  status: OutboxStatusValueObject;
  attempts: number;
  availableAt: Date;
  claimedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
}

export interface RehydratedOutboxMessage {
  readonly event: IntegrationEvent;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly availableAt: Date;
  readonly claimedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly lastError: string | null;
}

export class OutboxMessageEntity extends Entity<OutboxMessageProperties> {
  static pending(
    event: IntegrationEvent,
    now = new Date(),
  ): OutboxMessageEntity {
    validateEvent(event);
    const identifier = OutboxMessageIdentifierValueObject.create(event.eventId);
    if (!identifier.success) {
      throw new Error("An outbox message requires an identifier");
    }
    return new OutboxMessageEntity({
      identifier: identifier.value,
      event,
      status: OutboxStatusValueObject.pending(),
      attempts: 0,
      availableAt: now,
      claimedAt: null,
      publishedAt: null,
      lastError: null,
    });
  }

  static rehydrate(properties: RehydratedOutboxMessage): OutboxMessageEntity {
    validateEvent(properties.event);
    if (!Number.isSafeInteger(properties.attempts) || properties.attempts < 0) {
      throw new Error("Outbox attempts must be a non-negative integer");
    }
    const status = OutboxStatusValueObject.create(properties.status);
    if (!status.success) {
      throw new Error(`Unsupported outbox status: ${properties.status}`);
    }
    const identifier = OutboxMessageIdentifierValueObject.create(
      properties.event.eventId,
    );
    if (!identifier.success) {
      throw new Error("An outbox message requires an identifier");
    }
    return new OutboxMessageEntity({
      identifier: identifier.value,
      event: properties.event,
      status: status.value,
      attempts: properties.attempts,
      availableAt: properties.availableAt,
      claimedAt: properties.claimedAt,
      publishedAt: properties.publishedAt,
      lastError: properties.lastError,
    });
  }

  get event(): IntegrationEvent {
    return this.props.event;
  }

  get status(): OutboxStatus {
    return this.props.status.value;
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

  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  markPublished(now = new Date()): void {
    if (this.status !== "processing") {
      throw new Error("Only a processing outbox message can be published");
    }
    this.props.status = OutboxStatusValueObject.published();
    this.props.publishedAt = now;
    this.props.claimedAt = null;
    this.props.lastError = null;
  }

  markFailed(error: unknown, now = new Date()): void {
    if (this.status !== "processing") {
      throw new Error("Only a processing outbox message can fail");
    }
    this.props.attempts += 1;
    this.props.status =
      this.props.attempts >= 10
        ? OutboxStatusValueObject.deadLetter()
        : OutboxStatusValueObject.failed();
    const delay = Math.min(
      60_000,
      2 ** Math.min(this.props.attempts, 10) * 1_000,
    );
    this.props.availableAt = new Date(now.getTime() + delay);
    this.props.claimedAt = null;
    this.props.lastError = String(error).slice(0, 2_000);
  }
}

function validateEvent(event: IntegrationEvent): void {
  if (!event.eventId || !event.topic || !event.aggregateId) {
    throw new Error("An integration event requires identifiers and a topic");
  }
  if (!Number.isSafeInteger(event.version) || event.version < 1) {
    throw new Error("An integration event version must be a positive integer");
  }
  if (Number.isNaN(event.occurredAt.getTime())) {
    throw new Error("An integration event requires a valid occurrence date");
  }
}
