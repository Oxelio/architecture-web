import type { Result, ValueOf } from "@architecture/foundation";

import type { AuditEntry, AuditQuery } from "./audit.contracts.js";

export type OwnAuditEntry = Pick<
  AuditEntry,
  "id" | "type" | "occurredAt" | "result" | "actorType"
>;
export const AuditQueryErrors = {
  unauthorized: { code: "audit_consultation.unauthorized" },
  disabled: { code: "audit_consultation.disabled" },
  invalidPage: { code: "audit_consultation.invalid_page" },
  invalidPageSize: { code: "audit_consultation.invalid_page_size" },
  invalidFilter: { code: "audit_consultation.invalid_filter" },
} as const;
export type AuditQueryError = ValueOf<typeof AuditQueryErrors>;
export interface AuditAccess {
  resolveActor(actorUserId: string): Promise<{
    active: boolean;
    administrator: boolean;
    consultationEnabled: boolean;
    retentionDays: number;
  }>;
}
export interface ListOwnAuditEntriesInput {
  readonly actorUserId: string;
  readonly page?: number;
  readonly pageSize?: number;
}
export interface ListOwnAuditEntries {
  execute(
    input: ListOwnAuditEntriesInput,
  ): Promise<Result<readonly OwnAuditEntry[], AuditQueryError>>;
}
export interface ListAdministrativeAuditEntriesInput {
  readonly actorUserId: string;
  readonly filters: AuditQuery;
}
export interface ListAdministrativeAuditEntries {
  execute(
    input: ListAdministrativeAuditEntriesInput,
  ): Promise<Result<readonly AuditEntry[], AuditQueryError>>;
}
export interface AuditQueriesApplication {
  readonly listOwn: ListOwnAuditEntries;
  readonly listAdministrative: ListAdministrativeAuditEntries;
}
export function ownAuditEntry(entry: AuditEntry): OwnAuditEntry {
  return {
    id: entry.id,
    type: entry.type,
    occurredAt: entry.occurredAt,
    result: entry.result,
    actorType: entry.actorType,
  };
}
