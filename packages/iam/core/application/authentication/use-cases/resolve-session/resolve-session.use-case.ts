// @file bounded-contexts/iam/application/use-cases/resolve-session/resolve-session.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import { ResolveSessionErrorCodes } from "./resolve-session.codes.js";
import type {
  ResolveSession,
  ResolveSessionInput,
  ResolveSessionOutput,
  SessionResolution,
} from "./resolve-session.contracts.js";

export class ResolveSessionUseCase implements ResolveSession {
  private static readonly ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

  constructor(
    private readonly sessionPort: SessionRepository,
    private readonly userPort: UserRepository,
  ) {}

  async execute(payload: ResolveSessionInput): Promise<ResolveSessionOutput> {
    if (!payload.sessionId) {
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    const session = await this.sessionPort.findById(sessionId.value);
    if (!session || session.isExpired()) {
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    const user = await this.userPort.findById(session.userId);
    if (!user) {
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    if (user.status.isSuspended()) {
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    if (session.userSessionVersion !== user.sessionVersion) {
      await this.sessionPort.delete(session.identifier);
      return Result.failure(ResolveSessionErrorCodes.unauthorized);
    }

    const now = new Date();
    if (
      now.getTime() - session.lastActivityAt.getTime() >=
      ResolveSessionUseCase.ACTIVITY_UPDATE_INTERVAL_MS
    ) {
      await this.sessionPort.updateLastActivity(session.identifier, now);
    }

    const data: SessionResolution = {
      userId: user.identifier.value,
      sessionId: session.identifier.value,
      role: user.role.value,
    };

    return Result.success(data);
  }
}
