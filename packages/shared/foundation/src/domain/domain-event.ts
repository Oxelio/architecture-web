import { v4 as uuidv4 } from "uuid";

export interface DomainEventProperties<
  TType extends string,
  TPayload extends Record<string, unknown>,
> {
  readonly type: TType;
  readonly aggregateId: string;
  readonly payload: TPayload;
  readonly occurredAt?: Date;
  readonly eventId?: string;
}

/**
 * Immutable fact raised by a domain aggregate after a successful transition.
 */
export class DomainEvent<
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly type: TType;
  readonly aggregateId: string;
  readonly payload: Readonly<TPayload>;

  constructor(properties: DomainEventProperties<TType, TPayload>) {
    this.eventId = properties.eventId ?? uuidv4();
    this.occurredAt = properties.occurredAt ?? new Date();
    this.type = properties.type;
    this.aggregateId = properties.aggregateId;
    this.payload = Object.freeze({ ...properties.payload });
  }
}
