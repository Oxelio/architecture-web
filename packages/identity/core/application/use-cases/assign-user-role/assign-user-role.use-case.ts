import { Result } from "@architecture/foundation";

import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import { AssignUserRoleErrorCodes } from "./assign-user-role.codes.js";
import type {
  AssignUserRole,
  AssignUserRoleInput,
  AssignUserRoleOutput,
} from "./assign-user-role.contracts.js";

export class AssignUserRoleUseCase implements AssignUserRole {
  constructor(private readonly userPort: UserRepository) {}

  async execute(command: AssignUserRoleInput): Promise<AssignUserRoleOutput> {
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

    const user = await this.userPort.findById(userId.value);
    if (!user) {
      return Result.failure(AssignUserRoleErrorCodes.notFound);
    }

    user.changeRole(role.value);
    await this.userPort.save(user);

    return Result.success(undefined);
  }
}
