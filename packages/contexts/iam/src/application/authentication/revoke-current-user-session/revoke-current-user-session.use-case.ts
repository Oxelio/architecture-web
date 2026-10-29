import { Result } from "@architecture/foundation";

import type { SessionPolicyReader } from "#authentication/authentication-policy.reader";
import type { SessionRepository } from "#ports/session.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type {
  RevokeCurrentUserSession,
  RevokeCurrentUserSessionInput,
  RevokeCurrentUserSessionOutput,
} from "./revoke-current-user-session.contracts.js";
import { RevokeCurrentUserSessionErrors } from "./revoke-current-user-session.errors.js";

export class RevokeCurrentUserSessionUseCase implements RevokeCurrentUserSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
  ) {}

  async execute(
    input: RevokeCurrentUserSessionInput,
  ): Promise<RevokeCurrentUserSessionOutput> {
    if (!(await this.policies.getSessionPolicy()).userManagement) {
      return Result.failure(RevokeCurrentUserSessionErrors.featureDisabled);
    }
    const actorId = UserIdentifierValueObject.create(input.actorUserId);
    if (!actorId.success) {
      return Result.failure(RevokeCurrentUserSessionErrors.invalidActorId);
    }

    const sessionId = SessionIdentifierValueObject.create(input.sessionId);
    if (!sessionId.success) {
      return Result.failure(RevokeCurrentUserSessionErrors.invalidSessionId);
    }

    const session = await this.sessions.findById(sessionId.value);
    if (!session || !session.userId.equals(actorId.value)) {
      return Result.failure(RevokeCurrentUserSessionErrors.sessionNotFound);
    }

    await this.sessions.delete(sessionId.value);
    return Result.success(undefined);
  }
}
