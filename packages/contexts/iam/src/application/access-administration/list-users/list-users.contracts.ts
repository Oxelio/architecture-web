import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";
import type { UserRole } from "#value-objects/user-role.value-object";

export const USER_LIST_DEFAULT_PAGE = 1;
export const USER_LIST_DEFAULT_PAGE_SIZE = 25;
export const USER_LIST_MAX_PAGE_SIZE = 100;

export interface AdminUser {
  readonly userId: string;
  readonly loginIdentifiers: readonly {
    readonly kind: "username" | "email";
    readonly value: string;
    readonly verificationStatus: "not_required" | "pending" | "verified";
  }[];
  readonly email: string | null;
  readonly role: UserRole;
  readonly status: "active" | "suspended" | "pending_deletion";
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListUsersInput {
  readonly actorUserId: string;
  readonly search?: string;
  readonly role?: UserRole;
  readonly status?: "active" | "suspended" | "pending_deletion";
  readonly isEmailVerified?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface UserListPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface UserList {
  readonly users: readonly AdminUser[];
  readonly pagination: UserListPagination;
}

export const ListUsersErrors = {
  invalidPage: { code: "users.invalid_page" },
  invalidPageSize: { code: "users.invalid_page_size" },
} as const;

export type ListUsersError =
  | AdministratorAuthorizationError
  | (typeof ListUsersErrors)[keyof typeof ListUsersErrors];
export type ListUsersOutput = Result<UserList, ListUsersError>;

export interface ListUsers {
  execute(input: ListUsersInput): Promise<ListUsersOutput>;
}
