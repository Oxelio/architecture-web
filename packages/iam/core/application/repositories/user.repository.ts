// @file bounded-contexts/iam/application/ports/user.port.ts

import type { UserEntity } from "#entities/user.entity";
import type { EmailValueObject } from "#value-objects/email.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface UserSearchCriteria {
  readonly search?: string;
  readonly role?: "user" | "admin";
  readonly status?: "active" | "suspended";
  readonly isEmailVerified?: boolean;
  readonly page: number;
  readonly pageSize: number;
}

export interface UserSearchResult {
  readonly users: readonly UserEntity[];
  readonly total: number;
}

export interface UserAdministrationOverview {
  readonly total: number;
  readonly active: number;
  readonly suspended: number;
  readonly administrators: number;
}

export abstract class UserRepository {
  abstract save(user: UserEntity): Promise<void>;
  abstract findByEmail(email: EmailValueObject): Promise<UserEntity | null>;
  abstract findById(id: UserIdentifierValueObject): Promise<UserEntity | null>;
  abstract search(criteria: UserSearchCriteria): Promise<UserSearchResult>;
  abstract getAdministrationOverview(): Promise<UserAdministrationOverview>;
}
