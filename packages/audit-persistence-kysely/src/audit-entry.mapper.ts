import type { AuditEntry } from "@architecture/audit/application";
import { redactAuditMetadata } from "@architecture/audit/domain";

import type { AuditEventTable } from "./schema.js";

function mapMetadata(value: unknown): Record<string, unknown> {
  const parsed =
    typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : ((value ?? {}) as Record<string, unknown>);
  return redactAuditMetadata(parsed) as Record<string, unknown>;
}

export function toAuditEntry(row: AuditEventTable): AuditEntry {
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
    metadata: mapMetadata(row.metadata),
  };
}
