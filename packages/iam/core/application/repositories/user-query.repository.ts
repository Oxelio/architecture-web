import type { UserRole } from "#value-objects/user-role.value-object";

export interface UserAccountView {
  readonly userId: string;
  readonly role: UserRole;
  readonly status: "active" | "suspended" | "pending_deletion";
  readonly identifiers: readonly {
    readonly kind: "username" | "email";
    readonly value: string;
    readonly verificationStatus: "not_required" | "pending" | "verified";
  }[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserSearchCriteria {
  readonly search?: string;
  readonly role?: UserRole;
  readonly status?: UserAccountView["status"];
  readonly isEmailVerified?: boolean;
  readonly page: number;
  readonly pageSize: number;
}

export interface UserSearchResult {
  readonly users: readonly UserAccountView[];
  readonly total: number;
}

export interface UserAdministrationOverview {
  readonly total: number;
  readonly active: number;
  readonly suspended: number;
  readonly administrators: number;
}

export abstract class UserQueryRepository {
  abstract findAccountById(userId: string): Promise<UserAccountView | null>;
  abstract search(criteria: UserSearchCriteria): Promise<UserSearchResult>;
  abstract getAdministrationOverview(): Promise<UserAdministrationOverview>;
}
