import type { SessionPort } from "#application/ports/session.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { Result } from "@architecture/foundation";

export interface SignOutInput {
  sessionId: string;
}

export interface SignOutError {
  kind: "invalid_session_id";
}

export type SignOutResult = Result<void, SignOutError>;

export class SignOutUseCase {
  constructor(private readonly sessionPort: SessionPort) {}

  async execute(payload: SignOutInput): Promise<SignOutResult> {
    if (!payload.sessionId) {
      return Result.failure({ kind: "invalid_session_id" });
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    if (!sessionId.success) {
      return Result.failure({ kind: "invalid_session_id" });
    }

    await this.sessionPort.delete(sessionId.value);
    return Result.ok();
  }
}
