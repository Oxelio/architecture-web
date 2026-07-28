import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#repositories/session.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { RevokeCurrentUserSessionErrorCodes } from "./revoke-current-user-session.codes.js";
import type {
  RevokeCurrentUserSession,
  RevokeCurrentUserSessionInput,
  RevokeCurrentUserSessionOutput,
} from "./revoke-current-user-session.contracts.js";

export class RevokeCurrentUserSessionUseCase implements RevokeCurrentUserSession {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(
    input: RevokeCurrentUserSessionInput,
  ): Promise<RevokeCurrentUserSessionOutput> {
    const actorId = UserIdentifierValueObject.create(input.actorUserId);
    if (!actorId.success) {
      return Result.failure(RevokeCurrentUserSessionErrorCodes.invalidActorId);
    }

    const sessionId = SessionIdentifierValueObject.create(input.sessionId);
    if (!sessionId.success) {
      return Result.failure(
        RevokeCurrentUserSessionErrorCodes.invalidSessionId,
      );
    }

    const session = await this.sessions.findById(sessionId.value);
    if (!session || !session.userId.equals(actorId.value)) {
      return Result.failure(RevokeCurrentUserSessionErrorCodes.sessionNotFound);
    }

    await this.sessions.delete(sessionId.value);
    return Result.success(undefined);
  }
}
