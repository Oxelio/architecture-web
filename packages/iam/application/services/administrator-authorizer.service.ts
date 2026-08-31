import { Result, type ValueOf } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export const AdministratorAuthorizationErrorCodes = {
  unauthorized: { code: "administrator.unauthorized" },
} as const;

export type AdministratorAuthorizationError = ValueOf<
  typeof AdministratorAuthorizationErrorCodes
>;

export class AdministratorAuthorizer {
  constructor(private readonly users: UserRepository) {}

  async authorize(
    actorUserId: string,
  ): Promise<Result<void, AdministratorAuthorizationError>> {
    const actorId = UserIdentifierValueObject.create(actorUserId);
    if (!actorId.success) {
      return Result.failure(AdministratorAuthorizationErrorCodes.unauthorized);
    }

    const actor = await this.users.findById(actorId.value);
    if (!actor || !actor.status.isActive() || !actor.role.isAdmin()) {
      return Result.failure(AdministratorAuthorizationErrorCodes.unauthorized);
    }

    return Result.success(undefined);
  }
}
