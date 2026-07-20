// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import {
  ResolveSessionErrorCodes,
  ResolveSessionSuccessCodes,
} from "./resolve-session.codes.js";
import type {
  ResolveSessionInput,
  ResolveSessionOutput,
  SessionResolution,
} from "./resolve-session.types.js";

export class ResolveSessionUseCase {
  constructor(
    private readonly sessionPort: SessionPort,
    private readonly userPort: UserPort,
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

    return Result.success({
      code: ResolveSessionSuccessCodes.resolved.code,
      data,
    });
  }
}
