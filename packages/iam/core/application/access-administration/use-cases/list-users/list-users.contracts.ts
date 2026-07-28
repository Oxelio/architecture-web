import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#services/administrator-authorizer.service";
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

export interface ListUsersInput {
  readonly actorUserId: string;
}

export type ListUsersError = AdministratorAuthorizationError;
export type ListUsersOutput = Result<readonly AdminUser[], ListUsersError>;

export interface ListUsers {
  execute(input: ListUsersInput): Promise<ListUsersOutput>;
}
