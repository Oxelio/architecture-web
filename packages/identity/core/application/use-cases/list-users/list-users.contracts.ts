import type { Result } from "@architecture/foundation";

import type { UserRole } from "#value-objects/user-role.value-object";

export interface AdminUser {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: "active" | "suspended";
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ListUsersOutput = Result<readonly AdminUser[], never>;

export interface ListUsers {
  execute(): Promise<ListUsersOutput>;
}
