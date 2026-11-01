/** Maximum supported by the approved security configuration; bounds privacy markers too. */
export const MAX_AUDIT_RETENTION_DAYS = 3650;
export function auditExpiresAt(occurredAt: Date, retentionDays: number): Date {
  if (
    Number.isNaN(occurredAt.getTime()) ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > MAX_AUDIT_RETENTION_DAYS
  ) {
    throw new Error("Invalid Audit retention horizon");
  }
  return new Date(occurredAt.getTime() + retentionDays * 86_400_000);
}
