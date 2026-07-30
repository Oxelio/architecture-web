import type { Insertable, Kysely, Selectable } from "kysely";

import type { IntegrationEvent } from "./integration-event.js";
import { OutboxWriter } from "./integration-event.js";

export interface MessagingOutboxTable {
  id: string;
  topic: string;
  version: number;
  aggregate_id: string;
  occurred_at: Date;
  payload: string;
  context: string;
  status: "pending" | "processing" | "published" | "failed" | "dead_letter";
  attempts: number;
  available_at: Date;
  claimed_at: Date | null;
  published_at: Date | null;
  last_error: string | null;
}

export interface MessagingDatabase {
  messaging_outbox: MessagingOutboxTable;
}

export type OutboxRow = Selectable<MessagingOutboxTable>;

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return (value ?? {}) as Record<string, unknown>;
}

export function rowToIntegrationEvent(row: OutboxRow): IntegrationEvent {
  return {
    eventId: row.id,
    topic: row.topic,
    version: row.version,
    aggregateId: row.aggregate_id,
    occurredAt: row.occurred_at,
    payload: parseRecord(row.payload),
    context: parseRecord(row.context),
  };
}

export class KyselyOutboxWriter extends OutboxWriter {
  constructor(private readonly db: Kysely<MessagingDatabase>) {
    super();
  }

  async append(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const rows: Insertable<MessagingOutboxTable>[] = events.map((event) => ({
      id: event.eventId,
      topic: event.topic,
      version: event.version,
      aggregate_id: event.aggregateId,
      occurred_at: event.occurredAt,
      payload: JSON.stringify(event.payload),
      context: JSON.stringify(event.context),
      status: "pending",
      attempts: 0,
      available_at: new Date(),
      claimed_at: null,
      published_at: null,
      last_error: null,
    }));
    await this.db
      .insertInto("messaging_outbox")
      .values(rows as never)
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
  }
}

export class KyselyOutboxStore {
  constructor(private readonly db: Kysely<MessagingDatabase>) {}

  async claim(limit: number): Promise<OutboxRow[]> {
    return this.db.transaction().execute(async (transaction) => {
      const rows = await transaction
        .selectFrom("messaging_outbox")
        .selectAll()
        .where("status", "in", ["pending", "failed"])
        .where("available_at", "<=", new Date())
        .orderBy("occurred_at", "asc")
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();
      if (rows.length > 0) {
        await transaction
          .updateTable("messaging_outbox")
          .set({ status: "processing", claimed_at: new Date() })
          .where(
            "id",
            "in",
            rows.map((row) => row.id),
          )
          .execute();
      }
      return rows as OutboxRow[];
    });
  }

  async published(id: string): Promise<void> {
    await this.db
      .updateTable("messaging_outbox")
      .set({
        status: "published",
        published_at: new Date(),
        claimed_at: null,
        last_error: null,
      })
      .where("id", "=", id)
      .execute();
  }

  async failed(id: string, attempts: number, error: unknown): Promise<void> {
    const delay = Math.min(60_000, 2 ** Math.min(attempts, 10) * 1_000);
    await this.db
      .updateTable("messaging_outbox")
      .set({
        status: attempts >= 10 ? "dead_letter" : "failed",
        attempts,
        available_at: new Date(Date.now() + delay),
        claimed_at: null,
        last_error: String(error).slice(0, 2_000),
      })
      .where("id", "=", id)
      .execute();
  }

  async releaseStale(before: Date): Promise<void> {
    await this.db
      .updateTable("messaging_outbox")
      .set({ status: "failed", claimed_at: null, available_at: new Date() })
      .where("status", "=", "processing")
      .where("claimed_at", "<", before)
      .execute();
  }
}
