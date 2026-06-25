import type { LogoutUserCommand } from "./logout-user.command.js";

export class LogoutUserUseCase {
  async execute(payload: LogoutUserCommand): Promise<void> {
    const userId = payload.userId;

    throw new Error(`Not implemented yet for user: ${userId}`);
  }
}
