// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.use-case.ts

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

    const data: SessionResolution = {
      userId: user.identifier.value,
      sessionId: session.identifier.value,
    };

    return Result.success(data);
  }
}
