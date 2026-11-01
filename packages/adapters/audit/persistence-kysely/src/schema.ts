export interface AuditEventTable {
  id: string;
  type: string;
  occurred_at: Date;
  result: string;
  actor_type: string;
  actor_id: string | null;
  subject_id: string | null;
  actor_reference: string | null;
  subject_reference: string | null;
  correlation_id: string | null;
  network_fingerprint: string | null;
  client: string | null;
  metadata: string;
  expires_at: Date;
  legal_hold: boolean;
}

export interface AuditDatabase {
  audit_deleted_subjects: { reference: string; expires_at: Date };
  audit_events: AuditEventTable;
}
