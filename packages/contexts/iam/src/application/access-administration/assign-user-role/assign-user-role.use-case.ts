import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { UserRepository } from "#repositories/user.repository";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import { AssignUserRoleErrorCodes } from "./assign-user-role.codes.js";
import type {
  AssignUserRole,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./assign-user-role.contracts.js";

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
      return Result.failure(AssignUserRoleErrorCodes.invalidId);
    }
    if (command.actorUserId === userId.value.value) {
      return Result.failure(AssignUserRoleErrorCodes.selfOperation);
    }

    const role = UserRoleValueObject.create(command.role);
    if (!role.success) {
      return Result.failure(role.error);
    }

    const actorId = UserIdentifierValueObject.create(command.actorUserId);
    const result = await this.unitOfWork.executeForUser(
      userId.value,
      async ({ users }) => {
        const user = await users.findById(userId.value);
        if (!user) {
          return Result.failure(AssignUserRoleErrorCodes.notFound);
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
