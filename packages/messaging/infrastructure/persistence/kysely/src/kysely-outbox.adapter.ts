import {
  OutboxRepository,
  OutboxWriter,
} from "@architecture/messaging/application";
import {
  type IntegrationEvent,
  OutboxMessageEntity,
} from "@architecture/messaging/domain";
import type { Insertable, Kysely, Selectable } from "kysely";

import type { MessagingDatabase, MessagingOutboxTable } from "./schema.js";

type OutboxRow = Selectable<MessagingOutboxTable>;

export class KyselyOutboxWriterAdapter extends OutboxWriter {
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

export class KyselyOutboxRepositoryAdapter extends OutboxRepository {
  constructor(private readonly db: Kysely<MessagingDatabase>) {
    super();
  }

  async claim(limit: number): Promise<OutboxMessageEntity[]> {
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
      const claimedAt = new Date();
      if (rows.length > 0) {
        await transaction
          .updateTable("messaging_outbox")
          .set({ status: "processing", claimed_at: claimedAt })
          .where(
            "id",
            "in",
            rows.map((row) => row.id),
          )
          .execute();
      }
      return rows.map((row) =>
        outboxRowToEntity({
          ...row,
          status: "processing",
          claimed_at: claimedAt,
        } as OutboxRow),
      );
    });
  }

  async save(message: OutboxMessageEntity): Promise<void> {
    await this.db
      .updateTable("messaging_outbox")
      .set({
        status: message.status,
        attempts: message.attempts,
        available_at: message.availableAt,
        claimed_at: message.claimedAt,
        published_at: message.publishedAt,
        last_error: message.lastError,
      })
      .where("id", "=", message.identifier.value)
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

export function outboxRowToEntity(row: OutboxRow): OutboxMessageEntity {
  return OutboxMessageEntity.rehydrate({
    event: {
      eventId: row.id,
      topic: row.topic,
      version: row.version,
      aggregateId: row.aggregate_id,
      occurredAt: row.occurred_at,
      payload: parseRecord(row.payload),
      context: parseRecord(row.context),
    },
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    claimedAt: row.claimed_at,
    publishedAt: row.published_at,
    lastError: row.last_error,
  });
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return (value ?? {}) as Record<string, unknown>;
}
