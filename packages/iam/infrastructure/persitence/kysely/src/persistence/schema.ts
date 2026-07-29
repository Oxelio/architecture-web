// @file infrastructure/iam/persitence/kysely/src/persistence/schema.ts

import type { Insertable, Selectable } from "kysely";

export interface IamDatabase {
  iam_users: IamUserTable;
  iam_email_verifications: IamEmailVerificationTable;
  iam_password_recoveries: IamPasswordRecoveryTable;
  iam_mfa_settings: IamMfaSettingTable;
  iam_mfa_backup_codes: IamMfaBackupCodeTable;
  iam_mfa_challenges: IamMfaChallengeTable;
  iam_security_audit_events: IamSecurityAuditEventTable;
  iam_security_config_revisions: IamSecurityConfigRevisionTable;
  iam_account_exports: IamAccountExportTable;
  iam_account_deletions: IamAccountDeletionTable;
}

export interface IamUserTable {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  is_email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export type IamUserRow = Selectable<IamUserTable>;
export type NewIamUserRow = Insertable<IamUserTable>;

export interface IamEmailVerificationTable {
  token_hash: string;
  user_id: string;
  expires_at: Date;
  used: boolean;
  invalidated: boolean;
  created_at: Date;
}

export type IamEmailVerificationRow = Selectable<IamEmailVerificationTable>;
export type NewIamEmailVerificationRow = Insertable<IamEmailVerificationTable>;

export interface IamPasswordRecoveryTable {
  id: string;
  user_id: string;
  token_hash: string;
  email_fingerprint: string;
  expires_at: Date;
  consumed_at: Date | null;
  invalidated_at: Date | null;
  created_at: Date;
}

export interface IamMfaSettingTable {
  user_id: string;
  encrypted_secret: string;
  enrollment_expires_at: Date | null;
  enabled_at: Date | null;
  last_totp_counter: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IamMfaBackupCodeTable {
  id: string;
  user_id: string;
  code_hash: string;
  consumed_at: Date | null;
  created_at: Date;
}

export interface IamMfaChallengeTable {
  id: string;
  user_id: string;
  purpose: string;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
}

export interface IamSecurityAuditEventTable {
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

export interface IamSecurityConfigRevisionTable {
  id: string;
  version: number;
  status: string;
  values: string;
  created_by: string;
  created_at: Date;
  published_at: Date | null;
  previous_revision_id: string | null;
}

export interface IamAccountExportTable {
  id: string;
  user_id: string;
  status: string;
  archive: Buffer | null;
  failure_code: string | null;
  expires_at: Date | null;
  downloaded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IamAccountDeletionTable {
  id: string;
  user_id: string;
  previous_status: string;
  cancellation_token_hash: string;
  requested_at: Date;
  scheduled_for: Date;
  cancelled_at: Date | null;
  executed_at: Date | null;
  legal_hold_reason: string | null;
}
