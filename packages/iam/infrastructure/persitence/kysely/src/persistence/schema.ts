// @file infrastructure/iam/persitence/kysely/src/persistence/schema.ts

import type { Insertable, Selectable } from "kysely";

export interface IamDatabase {
  iam_users: IamUserTable;
  iam_email_verifications: IamEmailVerificationTable;
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
