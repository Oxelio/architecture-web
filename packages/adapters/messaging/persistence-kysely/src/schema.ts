import type { OutboxStatus } from "@architecture/messaging/domain";

export interface MessagingOutboxTable {
  id: string;
  topic: string;
  version: number;
  aggregate_id: string;
  occurred_at: Date;
  payload: string;
  context: string;
  status: OutboxStatus;
  attempts: number;
  available_at: Date;
  claimed_at: Date | null;
  claim_token: string | null;
  published_at: Date | null;
  last_error: string | null;
}

export interface MessagingDatabase {
  messaging_outbox: MessagingOutboxTable;
}
