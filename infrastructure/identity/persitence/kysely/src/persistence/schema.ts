import type { Insertable, Selectable } from "kysely";

export interface IdentityDatabase {
  identity_users: IdentityUserTable;
  identity_email_verifications: IdentityEmailVerificationTable;
}

export interface IdentityUserTable {
  id: string;
  email: string;
  password_hash: string;
  status: string;
  is_email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export type IdentityUserRow = Selectable<IdentityUserTable>;
export type NewIdentityUserRow = Insertable<IdentityUserTable>;

export interface IdentityEmailVerificationTable {
  token: string;
  user_id: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export type IdentityEmailVerificationRow =
  Selectable<IdentityEmailVerificationTable>;
export type NewIdentityEmailVerificationRow =
  Insertable<IdentityEmailVerificationTable>;
