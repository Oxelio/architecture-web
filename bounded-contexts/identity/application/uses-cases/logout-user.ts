import type { LogoutUserCommand } from "../commands/logout-user.js";

export class LogoutUser {
  async execute(payload: LogoutUserCommand): Promise<void> {
    const userId = payload.userId;

    throw new Error(`Not implemented yet for user: ${userId}`);
  }
}
