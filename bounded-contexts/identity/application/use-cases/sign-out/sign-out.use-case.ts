// @file bounded-contexts/identity/application/use-cases/sign-out/sign-out.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionPort } from "#application/ports/session.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import { SignOutErrorCodes, SignOutSuccessCodes } from "./sign-out.codes.js";
import type { SignOutInput, SignOutOutput } from "./sign-out.types.js";

export class SignOutUseCase {
  constructor(private readonly sessionPort: SessionPort) {}

  async execute(payload: SignOutInput): Promise<SignOutOutput> {
    if (!payload.sessionId) {
      return Result.failure(SignOutErrorCodes.invalidSessionId);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(SignOutErrorCodes.invalidSessionId);
    }

    await this.sessionPort.delete(sessionId.value);

    return Result.success(SignOutSuccessCodes.signedOut);
  }
}
