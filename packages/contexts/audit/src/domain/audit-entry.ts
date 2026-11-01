export type AuditResult = "success" | "denied" | "technical_failure";
export type AuditActorType = "user" | "administrator" | "system" | "anonymous";

export interface AuditContext {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly correlationId?: string;
  readonly ipAddress?: string;
  readonly networkFingerprint?: string;
  readonly client?: string;
}

export interface AuditEntryInput {
  readonly id?: string;
  readonly type: string;
  readonly occurredAt?: Date;
  readonly result: AuditResult;
  readonly context: AuditContext;
  readonly metadata?: Record<string, unknown>;
  readonly retentionDays: number;
}
