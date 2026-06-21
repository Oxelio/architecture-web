// bounded-contexts/identity/infrastructure/persistence/schema.ts
import type { Insertable, Selectable } from "kysely";

export interface IdentityDatabase {
  identity_users: IdentityUserTable;
}

export interface IdentityUserTable {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export type IdentityUserRow = Selectable<IdentityUserTable>;
export type NewIdentityUserRow = Insertable<IdentityUserTable>;
