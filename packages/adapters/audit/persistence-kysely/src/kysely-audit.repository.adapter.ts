import {
  type AuditQuery,
  AuditRepository,
} from "@architecture/audit/application";
import {
  type AuditEntryInput,
  auditExpiresAt,
  MAX_AUDIT_RETENTION_DAYS,
  pseudonymizeAuditMetadata,
  redactAuditMetadata,
} from "@architecture/audit/domain";
import { type Kysely, type SelectQueryBuilder, sql } from "kysely";

import { toAuditEntry } from "./audit-entry.mapper.js";
import type { AuditDatabase, AuditEventTable } from "./schema.js";

export class KyselyAuditRepositoryAdapter extends AuditRepository {
  constructor(private readonly db: Kysely<AuditDatabase>) {
    super();
  }

  async append(
    entry: AuditEntryInput & {
      readonly id: string;
      readonly actorReference: string | null;
      readonly subjectReference: string | null;
    },
  ): Promise<void> {
    const occurredAt = entry.occurredAt ?? new Date();
    const expiresAt = auditExpiresAt(occurredAt, entry.retentionDays);
    if (expiresAt <= new Date()) {
      return;
    }
    const fingerprint = entry.context.ipAddress
      ? await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(entry.context.ipAddress),
        )
      : undefined;
    await this.db.transaction().execute(async (transaction) => {
      const references = [
        ...new Set(
          [entry.actorReference, entry.subjectReference].filter(
            (reference): reference is string => reference !== null,
          ),
        ),
      ].sort();
      for (const reference of references) {
        await sql`select pg_advisory_xact_lock(hashtextextended(${reference}, 0))`.execute(
          transaction,
        );
      }
      const deleted = references.length
        ? await transaction
            .selectFrom("audit_deleted_subjects")
            .select("reference")
            .where("reference", "in", references)
            .where("expires_at", ">", sql<Date>`clock_timestamp()`)
            .execute()
        : [];
      const removed = new Set(deleted.map((row) => row.reference));
      const actorDeleted =
        entry.actorReference !== null && removed.has(entry.actorReference);
      const subjectDeleted =
        entry.subjectReference !== null && removed.has(entry.subjectReference);
      const replacements = new Map<string, string>();
      if (actorDeleted && entry.context.actorId && entry.actorReference) {
        replacements.set(entry.context.actorId, entry.actorReference);
      }
      if (subjectDeleted && entry.context.subjectId && entry.subjectReference) {
        replacements.set(entry.context.subjectId, entry.subjectReference);
      }
      await transaction
        .insertInto("audit_events")
        .values({
          id: entry.id,
          type: entry.type,
          occurred_at: occurredAt,
          result: entry.result,
          actor_type: entry.context.actorType,
          actor_id: actorDeleted ? null : (entry.context.actorId ?? null),
          subject_id: subjectDeleted ? null : (entry.context.subjectId ?? null),
          actor_reference: entry.actorReference,
          subject_reference: entry.subjectReference,
          correlation_id: entry.context.correlationId
            ? pseudonymizeAuditMetadata(
                entry.context.correlationId,
                replacements,
              ).slice(0, 128)
            : null,
          network_fingerprint:
            entry.context.networkFingerprint ??
            (fingerprint ? Buffer.from(fingerprint).toString("hex") : null),
          client: entry.context.client
            ? pseudonymizeAuditMetadata(
                entry.context.client,
                replacements,
              ).slice(0, 256)
            : null,
          metadata: JSON.stringify(
            pseudonymizeAuditMetadata(
              redactAuditMetadata(entry.metadata ?? {}),
              replacements,
            ),
          ),
          expires_at: expiresAt,
          legal_hold: false,
        })
        .onConflict((conflict) => conflict.column("id").doNothing())
        .execute();
    });
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
    return (rows as AuditEventTable[]).map(toAuditEntry);
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
    return (rows as AuditEventTable[]).map(toAuditEntry);
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
    return (rows as AuditEventTable[]).map(toAuditEntry);
  }

  async pseudonymizeSubject(reference: string): Promise<void> {
    await this.db.transaction().execute(async (transaction) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${reference}, 0))`.execute(
        transaction,
      );
      await transaction
        .insertInto("audit_deleted_subjects")
        .values({
          reference,
          expires_at: sql<Date>`clock_timestamp() + ${MAX_AUDIT_RETENTION_DAYS} * interval '1 day'`,
        })
        .onConflict((conflict) => conflict.column("reference").doNothing())
        .execute();
      const rows = await transaction
        .selectFrom("audit_events")
        .selectAll()
        .where((expression) =>
          expression.or([
            expression("actor_reference", "=", reference),
            expression("subject_reference", "=", reference),
          ]),
        )
        .orderBy("id", "asc")
        .forUpdate()
        .execute();
      for (const row of rows) {
        const replacements = new Map<string, string>();
        if (row.actor_reference === reference && row.actor_id) {
          replacements.set(row.actor_id, reference);
        }
        if (row.subject_reference === reference && row.subject_id) {
          replacements.set(row.subject_id, reference);
        }
        await transaction
          .updateTable("audit_events")
          .set({
            actor_id: row.actor_reference === reference ? null : row.actor_id,
            subject_id:
              row.subject_reference === reference ? null : row.subject_id,
            metadata: JSON.stringify(
              pseudonymizeAuditMetadata(
                toAuditEntry(row).metadata,
                replacements,
              ),
            ),
            correlation_id: row.correlation_id
              ? pseudonymizeAuditMetadata(row.correlation_id, replacements)
              : null,
            client: row.client
              ? pseudonymizeAuditMetadata(row.client, replacements)
              : null,
          })
          .where("id", "=", row.id)
          .execute();
      }
    });
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.db
      .deleteFrom("audit_events")
      .where("expires_at", "<=", now)
      .where("legal_hold", "=", false)
      .executeTakeFirst();
    await this.db
      .deleteFrom("audit_deleted_subjects")
      .where("expires_at", "<=", now)
      .execute();
    return Number(result.numDeletedRows);
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
