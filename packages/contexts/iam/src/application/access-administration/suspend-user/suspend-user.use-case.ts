import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { SessionRepository } from "#ports/session.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  SuspendUser,
  SuspendUserInput,
  SuspendUserOutput,
} from "./suspend-user.contracts.js";
import { SuspendUserErrors } from "./suspend-user.errors.js";

export class SuspendUserUseCase implements SuspendUser {
  constructor(
    private readonly authorizer: AdministratorAuthorizer,
    private readonly sessionPort: SessionRepository,
    private readonly unitOfWork: IamUnitOfWork,
  ) {}

  async execute(input: SuspendUserInput): Promise<SuspendUserOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(SuspendUserErrors.invalidId);
    }
    if (input.actorUserId === userId.value.value) {
      return Result.failure(SuspendUserErrors.selfOperation);
    }

    const actorId = UserIdentifierValueObject.create(input.actorUserId);
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
          return Result.failure(SuspendUserErrors.notFound);
        }
        if (
          user.role.isAdmin() &&
          user.status.isActive() &&
          !(await userQueries.hasOtherAdministrativeAccess(user.identifier))
        ) {
          return Result.failure({
            code: "administrator.last_active_access",
          } as const);
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
