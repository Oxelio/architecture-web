import type { LogoutUserCommand } from "./logout-user.command.js";
import type { SessionPort } from "#application/ports/session.port";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

export class LogoutUserUseCase {
  constructor(private readonly sessionPort: SessionPort) {}

  async execute(payload: LogoutUserCommand): Promise<void> {
    if (!payload.sessionId) {
      return;
    }

    const sessionId = SessionIdentifierValueObject.create(payload.sessionId);

    await this.sessionPort.delete(sessionId);
  }
}
