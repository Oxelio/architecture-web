import type {
  IntegrationEvent,
  OutboxMessageEntity,
} from "@architecture/messaging/domain";

export abstract class OutboxWriter {
  abstract append(events: readonly IntegrationEvent[]): Promise<void>;
}

export abstract class OutboxRepository {
  abstract claim(): Promise<OutboxClaim | null>;
  abstract finalize(claim: OutboxClaim): Promise<boolean>;
  abstract recoverStale(): Promise<void>;
}

export interface OutboxClaim {
  readonly message: OutboxMessageEntity;
  readonly claimToken: string;
}
