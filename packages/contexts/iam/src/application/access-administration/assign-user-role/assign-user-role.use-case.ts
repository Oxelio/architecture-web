import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import type {
  AssignUserRole,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./assign-user-role.contracts.js";
import { AssignUserRoleErrors } from "./assign-user-role.errors.js";

export class AssignUserRoleUseCase implements AssignUserRole {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    userPort: UserRepository,
    private readonly unitOfWork: IamUnitOfWork,
  ) {
    this.authorizer = new AdministratorAuthorizer(userPort);
  }

  async execute(command: AssignUserRoleInput): Promise<AssignUserRoleOutput> {
    const authorization = await this.authorizer.authorize(command.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(AssignUserRoleErrors.invalidId);
    }
    if (command.actorUserId === userId.value.value) {
      return Result.failure(AssignUserRoleErrors.selfOperation);
    }

    const role = UserRoleValueObject.create(command.role);
    if (!role.success) {
      return Result.failure(role.error);
    }

    const actorId = UserIdentifierValueObject.create(command.actorUserId);
    const result = await this.unitOfWork.executeForUser(
      userId.value,
      async ({ users, userQueries }) => {
        const actor = actorId.success
          ? await users.findById(actorId.value)
          : null;
        if (!actor?.role.isAdmin() || !actor.status.isActive()) {
          return Result.failure({
            code: "administrator.unauthorized",
          } as const);
        }
        const user = await users.findById(userId.value);
        if (!user) {
          return Result.failure(AssignUserRoleErrors.notFound);
        }
        if (
          user.role.isAdmin() &&
          user.status.isActive() &&
          !role.value.isAdmin() &&
          !(await userQueries.hasOtherAdministrativeAccess(user.identifier))
        ) {
          return Result.failure({
            code: "administrator.last_active_access",
          } as const);
        }
        user.changeRole(
          role.value,
          actorId.success ? actorId.value : undefined,
        );
        await users.save(user);
        return Result.success(undefined);
      },
    );
    if (!result.success) {
      return result;
    }
    return Result.success(undefined);
  }
}
