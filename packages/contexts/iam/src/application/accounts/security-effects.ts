export interface SecurityContext {
  readonly actorType: "user" | "administrator" | "system" | "anonymous";
  readonly actorId?: string;
  readonly subjectId?: string;
  readonly correlationId?: string;
  readonly ipAddress?: string;
  readonly client?: string;
}
export interface SecurityEventRecorder {
  record(
    type: string,
    result: "success" | "denied" | "technical_failure",
    context: SecurityContext,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}
export interface RecoveryOriginLimiter {
  countRecent(fingerprint: string, since: Date): Promise<number>;
}
export interface SecurityTokens {
  generate(): string;
  identifier(): string;
  hash(value: string): string;
}
export interface AccountSecurityMail {
  sendRecovery(email: string, token: string): Promise<void>;
  sendDeletionCancellation(email: string, token: string): Promise<void>;
}
