import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  ActivateUser,
  ActivateUserInput,
  ActivateUserOutput,
} from "./activate-user.contracts.js";
import { ActivateUserErrors } from "./activate-user.contracts.js";

export class ActivateUserUseCase implements ActivateUser {
  constructor(
    private readonly authorizer: AdministratorAuthorizer,
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(command: ActivateUserInput): Promise<ActivateUserOutput> {
    const authorization = await this.authorizer.authorize(command.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(command.userId);
    if (!userId.success) {
      return Result.failure(ActivateUserErrors.invalidId);
    }

    const actorId = UserIdentifierValueObject.create(command.actorUserId);
    const result = await this.unitOfWork.executeForUser(
      userId.value,
      async ({ users }) => {
        const user = await users.findById(userId.value);
        if (!user) {
          return Result.failure(ActivateUserErrors.notFound);
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
