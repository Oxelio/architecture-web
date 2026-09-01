import type {
  IntegrationEvent,
  OutboxMessageEntity,
} from "@architecture/messaging/domain";

export abstract class OutboxWriter {
  abstract append(events: readonly IntegrationEvent[]): Promise<void>;
}

export abstract class OutboxRepository {
  abstract claim(limit: number): Promise<OutboxMessageEntity[]>;
  abstract save(message: OutboxMessageEntity): Promise<void>;
  abstract releaseStale(before: Date): Promise<void>;
}
