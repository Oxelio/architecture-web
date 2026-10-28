// @file bounded-contexts/iam/application/use-cases/activate-user/activate-user.use-case.ts

import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ActivateUserErrorsCodes } from "./activate-user.codes.js";
import type {
  ActivateUser,
  ActivateUserInput,
  ActivateUserOutput,
} from "./activate-user.contracts.js";

export class ActivateUserUseCase implements ActivateUser {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    userPort: UserRepository,
    private readonly unitOfWork: IamUnitOfWork,
  ) {
    this.authorizer = new AdministratorAuthorizer(userPort);
  }

  async execute(command: ActivateUserInput): Promise<ActivateUserOutput> {
    const authorization = await this.authorizer.authorize(command.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ActivateUserErrorsCodes.invalidId);
    }

    const actorId = UserIdentifierValueObject.create(command.actorUserId);
    const result = await this.unitOfWork.executeForUser(
      userId.value,
      async ({ users }) => {
        const user = await users.findById(userId.value);
        if (!user) {
          return Result.failure(ActivateUserErrorsCodes.notFound);
        }
        user.activate(actorId.success ? actorId.value : undefined);
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
