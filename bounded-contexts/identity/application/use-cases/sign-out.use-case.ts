// @file bounded-contexts/identity/application/use-cases/sign-out.use-case.ts

import { type ErrorOf, Result } from "@architecture/foundation";

import type { SessionPort } from "#application/ports/session.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

export interface SignOutInput {
  sessionId: string;
}

const SignOutErrors = {
  invalidSessionId: {
    code: "invalid_session_id",
  },
} as const;

export type SignOutError = ErrorOf<typeof SignOutErrors>;

export type SignOutResult = Result<void, SignOutError>;

export class SignOutUseCase {
  constructor(private readonly sessionPort: SessionPort) {}

  async execute(payload: SignOutInput): Promise<SignOutResult> {
    if (!payload.sessionId) {
      return Result.failure(SignOutErrors.invalidSessionId);
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure(SignOutErrors.invalidSessionId);
    }

    await this.sessionPort.delete(sessionId.value);
    return Result.ok();
  }
}
