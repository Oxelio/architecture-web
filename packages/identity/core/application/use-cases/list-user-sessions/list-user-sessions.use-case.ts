import { Result } from "@architecture/foundation";

import type { SessionAdministrationRepository } from "#repositories/session.repository";
import type { UserAdministrationRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListUserSessionsErrorCodes } from "./list-user-sessions.codes.js";
import type {
  ListUserSessions,
  ListUserSessionsInput,
  ListUserSessionsOutput,
} from "./list-user-sessions.contracts.js";

export class ListUserSessionsUseCase implements ListUserSessions {
  constructor(
    private readonly users: UserAdministrationRepository,
    private readonly sessions: SessionAdministrationRepository,
  ) {}

  async execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput> {
    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(ListUserSessionsErrorCodes.invalidUserId);
    }

    if (!(await this.users.findById(userId.value))) {
      return Result.failure(ListUserSessionsErrorCodes.userNotFound);
    }

    const sessions = await this.sessions.findAllForUser(userId.value);
    return Result.success(
      sessions.map((session) => ({
        sessionId: session.identifier.value,
        expiresAt: session.expiresAt.toISOString(),
      })),
    );
  }
}
