export interface IntegrationEvent<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly eventId: string;
  readonly topic: string;
  readonly version: number;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<TPayload>;
  readonly context: Readonly<TContext>;
}

export interface IntegrationEventHandler {
  readonly topics: readonly string[];
  handle(event: IntegrationEvent): Promise<void>;
}

export abstract class OutboxWriter {
  abstract append(events: readonly IntegrationEvent[]): Promise<void>;
}
