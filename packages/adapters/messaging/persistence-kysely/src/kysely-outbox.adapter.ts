import { randomUUID } from "node:crypto";

import {
  type OutboxClaim,
  OutboxRepository,
  OutboxWriter,
} from "@architecture/messaging/application";
import {
  type IntegrationEvent,
  OutboxMessageEntity,
} from "@architecture/messaging/domain";
import { type Kysely, type Selectable, sql } from "kysely";

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
    const rows = events.map((event) => ({
      id: event.eventId,
      topic: event.topic,
      version: event.version,
      aggregate_id: event.aggregateId,
      occurred_at: event.occurredAt,
      payload: JSON.stringify(event.payload),
      context: JSON.stringify(event.context),
      status: "pending" as const,
      attempts: 0,
      available_at: sql<Date>`clock_timestamp()`,
      claimed_at: null,
      claim_token: null,
      published_at: null,
      last_error: null,
    }));
    await this.db
      .insertInto("messaging_outbox")
      .values(rows)
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
  }
}

export class KyselyOutboxRepositoryAdapter extends OutboxRepository {
  constructor(private readonly db: Kysely<MessagingDatabase>) {
    super();
  }

  async claim(): Promise<OutboxClaim | null> {
    return this.db.transaction().execute(async (transaction) => {
      const row = await transaction
        .selectFrom("messaging_outbox")
        .selectAll()
        .where("status", "in", ["pending", "failed"])
        .where("available_at", "<=", sql<Date>`clock_timestamp()`)
        .where("attempts", "<", 10)
        .orderBy("occurred_at", "asc")
        .orderBy("id", "asc")
        .limit(1)
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      const claimToken = randomUUID();
      const claimed = await transaction
        .updateTable("messaging_outbox")
        .set({
          status: "processing",
          claimed_at: sql<Date>`clock_timestamp()`,
          claim_token: claimToken,
          attempts: row.attempts + 1,
        })
        .where("id", "=", row.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { message: outboxRowToEntity(claimed), claimToken };
    });
  }

  async finalize({ message, claimToken }: OutboxClaim): Promise<boolean> {
    if (
      message.status !== "published" &&
      message.status !== "failed" &&
      message.status !== "dead_letter"
    ) {
      throw new Error("Only a completed attempt can be finalized");
    }
    const result = await this.db
      .updateTable("messaging_outbox")
      .set({
        status: message.status,
        attempts: message.attempts,
        available_at: sql<Date>`clock_timestamp() + least(60, power(2, least(${message.attempts}, 10))) * interval '1 second'`,
        claimed_at: null,
        claim_token: null,
        published_at:
          message.status === "published" ? sql<Date>`clock_timestamp()` : null,
        last_error: message.lastError,
      })
      .where("id", "=", message.identifier.value)
      .where("status", "=", "processing")
      .where("claim_token", "=", claimToken)
      .where(
        "claimed_at",
        ">",
        sql<Date>`clock_timestamp() - interval '5 minutes'`,
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async recoverStale(): Promise<void> {
    await this.db
      .updateTable("messaging_outbox")
      .set({
        status: sql`case when attempts >= 10 then 'dead_letter' else 'failed' end`,
        claimed_at: null,
        claim_token: null,
        available_at: sql<Date>`clock_timestamp() + least(60, power(2, least(attempts, 10))) * interval '1 second'`,
        last_error: "Processing claim expired",
      })
      .where("status", "=", "processing")
      .where(
        "claimed_at",
        "<=",
        sql<Date>`clock_timestamp() - interval '5 minutes'`,
      )
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
