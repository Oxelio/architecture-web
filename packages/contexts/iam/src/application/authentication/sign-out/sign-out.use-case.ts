import { Result } from "@architecture/foundation";

import type { SessionRepository } from "#ports/session.repository";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

import type {
  SignOut,
  SignOutInput,
  SignOutOutput,
} from "./sign-out.contracts.js";
import { SignOutErrors } from "./sign-out.contracts.js";

export class SignOutUseCase implements SignOut {
  constructor(private readonly sessionPort: SessionRepository) {}

  async execute(payload: SignOutInput): Promise<SignOutOutput> {
    if (!payload.sessionId) {
      return Result.failure(SignOutErrors.invalidSessionId);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(SignOutErrors.invalidSessionId);
    }

    await this.sessionPort.delete(sessionId.value);

    return Result.success(undefined);
  }
}
