// @file bounded-contexts/iam/application/use-cases/suspend-user/suspend-user.use-case.ts

import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { IamUnitOfWork } from "#transactions/iam-unit-of-work";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SuspendUserErrorCodes } from "./suspend-user.codes.js";
import type {
  SuspendUser,
  SuspendUserInput,
  SuspendUserOutput,
} from "./suspend-user.contracts.js";

export class SuspendUserUseCase implements SuspendUser {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    userPort: UserRepository,
    private readonly sessionPort: SessionRepository,
    private readonly unitOfWork: IamUnitOfWork,
  ) {
    this.authorizer = new AdministratorAuthorizer(userPort);
  }

  async execute(input: SuspendUserInput): Promise<SuspendUserOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(SuspendUserErrorCodes.invalidId);
    }
    if (input.actorUserId === userId.value.value) {
      return Result.failure(SuspendUserErrorCodes.selfOperation);
    }

    const actorId = UserIdentifierValueObject.create(input.actorUserId);
    const result = await this.unitOfWork.executeForUser(
      userId.value,
      async ({ users }) => {
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
          return Result.failure(SuspendUserErrorCodes.notFound);
        }
        if (
          user.role.isAdmin() &&
          user.status.isActive() &&
          !(await users.hasOtherAdministrativeAccess(user.identifier))
        ) {
          return Result.failure({ code: "LAST_ACTIVE_ADMIN" } as const);
        }
        user.suspend(actorId.success ? actorId.value : undefined);
        await users.save(user);
        return Result.success(undefined);
      },
    );
    if (!result.success) {
      return result;
    }
    await this.sessionPort.deleteAllForUser(userId.value);
    return Result.success(undefined);
  }
}
