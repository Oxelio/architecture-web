import type { AuditEntryInput } from "#domain/audit-entry";

export interface AuditRecorder {
  record(input: AuditEntryInput): Promise<void>;
}

export interface AuditEventConsumer extends AuditRecorder {
  removeAccountReferences(reference: string): Promise<void>;
}

export interface AuditQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly type?: string;
  readonly result?: string;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly correlationId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface AuditEntry {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: Date;
  readonly result: string;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly subjectId: string | null;
  readonly correlationId: string | null;
  readonly client: string | null;
  readonly metadata: Record<string, unknown>;
}
