// @file infrastructure/iam/persitence/kysely/src/persistence/schema.ts

import type { Insertable, Selectable } from "kysely";

export interface IamDatabase {
  iam_users: IamUserTable;
  iam_login_identities: IamLoginIdentityTable;
  iam_password_authenticators: IamPasswordAuthenticatorTable;
  iam_email_verifications: IamEmailVerificationTable;
  iam_password_recoveries: IamPasswordRecoveryTable;
  iam_mfa_settings: IamMfaSettingTable;
  iam_mfa_backup_codes: IamMfaBackupCodeTable;
  iam_mfa_challenges: IamMfaChallengeTable;
  iam_security_config_revisions: IamSecurityConfigRevisionTable;
  iam_account_exports: IamAccountExportTable;
  iam_account_deletions: IamAccountDeletionTable;
}

export interface IamUserTable {
  id: string;
  role: string;
  status: string;
  session_version: number;
  created_at: Date;
  updated_at: Date;
}

export type IamUserRow = Selectable<IamUserTable>;
export type NewIamUserRow = Insertable<IamUserTable>;

export interface IamLoginIdentityTable {
  id: string;
  user_id: string;
  kind: string;
  normalized_value: string;
  verification_status: string;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type IamLoginIdentityRow = Selectable<IamLoginIdentityTable>;

export interface IamPasswordAuthenticatorTable {
  id: string;
  user_id: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export type IamPasswordAuthenticatorRow =
  Selectable<IamPasswordAuthenticatorTable>;

export interface IamEmailVerificationTable {
  token_hash: string;
  user_id: string;
  login_identity_id: string;
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
