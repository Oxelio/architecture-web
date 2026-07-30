import type { Kysely, SelectQueryBuilder } from "kysely";

import {
  type AuditEntry,
  type AuditEntryInput,
  type AuditQuery,
  AuditRepository,
  redact,
} from "./audit.js";

export interface AuditEventTable {
  id: string;
  type: string;
  occurred_at: Date;
  result: string;
  actor_type: string;
  actor_id: string | null;
  subject_id: string | null;
  correlation_id: string | null;
  network_fingerprint: string | null;
  client: string | null;
  metadata: string;
  expires_at: Date;
  legal_hold: boolean;
}

export interface AuditDatabase {
  audit_events: AuditEventTable;
}

function metadata(value: unknown): Record<string, unknown> {
  const parsed =
    typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : ((value ?? {}) as Record<string, unknown>);
  return redact(parsed) as Record<string, unknown>;
}

function toEntry(row: AuditEventTable): AuditEntry {
  return {
    id: row.id,
    type: row.type,
    occurredAt: row.occurred_at,
    result: row.result,
    actorType: row.actor_type,
    actorId: row.actor_id,
    subjectId: row.subject_id,
    correlationId: row.correlation_id,
    client: row.client,
    metadata: metadata(row.metadata),
  };
}

export class KyselyAuditRepository extends AuditRepository {
  constructor(private readonly db: Kysely<AuditDatabase>) {
    super();
  }

  async append(
    entry: AuditEntryInput & { readonly id: string },
  ): Promise<void> {
    const now = entry.occurredAt ?? new Date();
    const fingerprint = entry.context.ipAddress
      ? await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(entry.context.ipAddress),
        )
      : undefined;
    await this.db
      .insertInto("audit_events")
      .values({
        id: entry.id,
        type: entry.type,
        occurred_at: now,
        result: entry.result,
        actor_type: entry.context.actorType,
        actor_id: entry.context.actorId ?? null,
        subject_id: entry.context.subjectId ?? null,
        correlation_id: entry.context.correlationId?.slice(0, 128) ?? null,
        network_fingerprint: fingerprint
          ? Buffer.from(fingerprint).toString("hex")
          : null,
        client: entry.context.client?.slice(0, 256) ?? null,
        metadata: JSON.stringify(redact(entry.metadata ?? {})),
        expires_at: new Date(now.getTime() + entry.retentionDays * 86_400_000),
        legal_hold: false,
      } as never)
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
  }

  async listForSubject(userId: string, page: number, pageSize: number) {
    const size = Math.min(100, Math.max(1, pageSize));
    const rows = await this.db
      .selectFrom("audit_events")
      .selectAll()
      .where((expression) =>
        expression.or([
          expression("actor_id", "=", userId),
          expression("subject_id", "=", userId),
        ]),
      )
      .orderBy("occurred_at", "desc")
      .orderBy("id", "desc")
      .limit(size)
      .offset((Math.max(1, page) - 1) * size)
      .execute();
    return (rows as AuditEventTable[]).map(toEntry);
  }

  async query(filters: AuditQuery) {
    let query = this.db.selectFrom("audit_events").selectAll();
    query = this.applyFilters(query, filters);
    const size = Math.min(100, Math.max(1, filters.pageSize));
    const rows = await query
      .orderBy("occurred_at", "desc")
      .orderBy("id", "desc")
      .limit(size)
      .offset((Math.max(1, filters.page) - 1) * size)
      .execute();
    return (rows as AuditEventTable[]).map(toEntry);
  }

  async exportForSubject(userId: string) {
    const rows = await this.db
      .selectFrom("audit_events")
      .selectAll()
      .where((expression) =>
        expression.or([
          expression("actor_id", "=", userId),
          expression("subject_id", "=", userId),
        ]),
      )
      .orderBy("occurred_at", "desc")
      .orderBy("id", "desc")
      .limit(10_000)
      .execute();
    return (rows as AuditEventTable[]).map(toEntry);
  }

  async pseudonymizeSubject(userId: string, reference: string): Promise<void> {
    await this.db
      .updateTable("audit_events")
      .set({
        actor_id: null,
        subject_id: null,
        metadata: JSON.stringify({ pseudonymousSubject: reference }),
      } as never)
      .where((expression) =>
        expression.or([
          expression("actor_id", "=", userId),
          expression("subject_id", "=", userId),
        ]),
      )
      .execute();
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.db
      .deleteFrom("audit_events")
      .where("expires_at", "<=", now)
      .where("legal_hold", "=", false)
      .executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  async countRecentByNetworkFingerprint(
    type: string,
    fingerprint: string,
    since: Date,
  ): Promise<number> {
    const row = await this.db
      .selectFrom("audit_events")
      .select(({ fn }) => fn.countAll().as("count"))
      .where("type", "=", type)
      .where("network_fingerprint", "=", fingerprint)
      .where("occurred_at", ">", since)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private applyFilters(
    query: SelectQueryBuilder<AuditDatabase, "audit_events", AuditEventTable>,
    filters: AuditQuery,
  ) {
    let filtered = query;
    if (filters.type) {
      filtered = filtered.where("type", "=", filters.type);
    }
    if (filters.result) {
      filtered = filtered.where("result", "=", filters.result);
    }
    if (filters.actorId) {
      filtered = filtered.where("actor_id", "=", filters.actorId);
    }
    if (filters.subjectId) {
      filtered = filtered.where("subject_id", "=", filters.subjectId);
    }
    if (filters.correlationId) {
      filtered = filtered.where("correlation_id", "=", filters.correlationId);
    }
    if (filters.from) {
      filtered = filtered.where("occurred_at", ">=", filters.from);
    }
    if (filters.to) {
      filtered = filtered.where("occurred_at", "<=", filters.to);
    }
    return filtered;
  }
}
