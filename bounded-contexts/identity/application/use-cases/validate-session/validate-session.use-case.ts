import { Result } from "@architecture/foundation";
import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { ValidateSessionCommand } from "./validate-session.command.js";
import type { ValidateSessionResult } from "./validate-session.result.js";

export class ValidateSessionUseCase {
  constructor(
    private readonly sessionPort: SessionPort,
    private readonly userPort: UserPort,
  ) {}

  async execute(
    payload: ValidateSessionCommand,
  ): Promise<ValidateSessionResult> {
    if (!payload.sessionId) {
      return Result.failure({ kind: "unauthorized" });
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);
    const session = await this.sessionPort.findById(sessionId);

    if (!session || session.isExpired()) {
      return Result.failure({ kind: "unauthorized" });
    }

    const user = await this.userPort.findById(session.userId);

    if (!user) {
      return Result.failure({ kind: "unauthorized" });
    }

    return Result.ok({
      userId: user.identifier.value,
      sessionId: session.identifier.value,
    });
  }
}
