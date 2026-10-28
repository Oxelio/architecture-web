// @file bounded-contexts/iam/application/use-cases/sign-out/sign-out.use-case.ts

import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#ports/session.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import { SignOutErrorCodes } from "./sign-out.codes.js";
import type {
  SignOut,
  SignOutInput,
  SignOutOutput,
} from "./sign-out.contracts.js";

export class SignOutUseCase implements SignOut {
  constructor(private readonly sessionPort: SessionRepository) {}

  async execute(payload: SignOutInput): Promise<SignOutOutput> {
    if (!payload.sessionId) {
      return Result.failure(SignOutErrorCodes.invalidSessionId);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(SignOutErrorCodes.invalidSessionId);
    }

    await this.sessionPort.delete(sessionId.value);

    return Result.success(undefined);
  }
}
