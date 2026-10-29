import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { SessionPolicyReader } from "#authentication/authentication-policy.reader";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  RevokeUserSession,
  RevokeUserSessionInput,
  RevokeUserSessionOutput,
} from "./revoke-user-session.contracts.js";
import { RevokeUserSessionErrors } from "./revoke-user-session.errors.js";

export class RevokeUserSessionUseCase implements RevokeUserSession {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
    private readonly authorizer: AdministratorAuthorizer,
  ) {}

  async execute(
    input: RevokeUserSessionInput,
  ): Promise<RevokeUserSessionOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    if (!(await this.policies.getSessionPolicy()).userManagement) {
      return Result.failure(RevokeUserSessionErrors.featureDisabled);
    }
    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(RevokeUserSessionErrors.invalidUserId);
    }
    if (!(await this.users.findById(userId.value))) {
      return Result.failure(RevokeUserSessionErrors.userNotFound);
    }

    if (!input.sessionId) {
      await this.sessions.deleteAllForUser(userId.value);
      return Result.success(undefined);
    }

    const sessionId = SessionIdentifierValueObject.create(input.sessionId);
    if (!sessionId.success) {
      return Result.failure(RevokeUserSessionErrors.invalidSessionId);
    }
    const session = await this.sessions.findById(sessionId.value);
    if (!session || !session.userId.equals(userId.value)) {
      return Result.failure(RevokeUserSessionErrors.sessionNotFound);
    }

    await this.sessions.delete(sessionId.value);
    return Result.success(undefined);
  }
}
