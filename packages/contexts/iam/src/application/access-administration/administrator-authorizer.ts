import { Result, type ValueOf } from "@architecture/foundation";

import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export const AdministratorAuthorizationErrors = {
  unauthorized: { code: "administrator.unauthorized" },
} as const;

export type AdministratorAuthorizationError = ValueOf<
  typeof AdministratorAuthorizationErrors
>;

export class AdministratorAuthorizer {
  constructor(private readonly users: UserRepository) {}

  async authorize(
    actorUserId: string,
  ): Promise<Result<void, AdministratorAuthorizationError>> {
    const actorId = UserIdentifierValueObject.create(actorUserId);
    if (!actorId.success) {
      return Result.failure(AdministratorAuthorizationErrors.unauthorized);
    }

    const actor = await this.users.findById(actorId.value);
    if (!actor || !actor.status.isActive() || !actor.role.isAdmin()) {
      return Result.failure(AdministratorAuthorizationErrors.unauthorized);
    }

    return Result.success(undefined);
  }
}
