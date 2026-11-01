import type { AuditEntryInput } from "#domain/audit-entry";

import type { AuditEntry, AuditQuery } from "../audit.contracts.js";

export abstract class AuditRepository {
  abstract append(
    entry: AuditEntryInput & {
      readonly id: string;
      readonly actorReference: string | null;
      readonly subjectReference: string | null;
    },
  ): Promise<void>;
  abstract listForSubject(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<AuditEntry[]>;
  abstract query(filters: AuditQuery): Promise<AuditEntry[]>;
  abstract exportForSubject(userId: string): Promise<AuditEntry[]>;
  abstract pseudonymizeSubject(reference: string): Promise<void>;
  abstract purgeExpired(now: Date): Promise<number>;
}
