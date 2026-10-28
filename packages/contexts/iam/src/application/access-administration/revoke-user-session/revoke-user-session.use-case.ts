import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { SessionPolicyReader } from "#authentication/authentication-policy.reader";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { RevokeUserSessionErrorCodes } from "./revoke-user-session.codes.js";
import type {
  RevokeUserSession,
  RevokeUserSessionInput,
  RevokeUserSessionOutput,
} from "./revoke-user-session.contracts.js";

export class RevokeUserSessionUseCase implements RevokeUserSession {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
  ) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

  async execute(
    input: RevokeUserSessionInput,
  ): Promise<RevokeUserSessionOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    if (!(await this.policies.getSessionPolicy()).userManagement) {
      return Result.failure(RevokeUserSessionErrorCodes.featureDisabled);
    }
    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(RevokeUserSessionErrorCodes.invalidUserId);
    }
    if (!(await this.users.findById(userId.value))) {
      return Result.failure(RevokeUserSessionErrorCodes.userNotFound);
    }

    if (!input.sessionId) {
      await this.sessions.deleteAllForUser(userId.value);
      return Result.success(undefined);
    }

    const sessionId = SessionIdentifierValueObject.create(input.sessionId);
    if (!sessionId.success) {
      return Result.failure(RevokeUserSessionErrorCodes.invalidSessionId);
    }
    const session = await this.sessions.findById(sessionId.value);
    if (!session || !session.userId.equals(userId.value)) {
      return Result.failure(RevokeUserSessionErrorCodes.sessionNotFound);
    }

    await this.sessions.delete(sessionId.value);
    return Result.success(undefined);
  }
}
