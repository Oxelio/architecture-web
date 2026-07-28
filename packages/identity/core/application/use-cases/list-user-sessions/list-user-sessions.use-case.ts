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
        userId: session.userId.value,
        sessionId: session.identifier.value,
        createdAt: session.createdAt?.toISOString() ?? null,
        lastActivityAt: session.lastActivityAt?.toISOString() ?? null,
        expiresAt: session.expiresAt.toISOString(),
        isActive: session.isValid(),
        isCurrent: session.identifier.value === input.currentSessionId,
        client: {
          type: session.client?.type ?? "unknown",
          name: session.client?.name ?? null,
          version: session.client?.version ?? null,
          deviceType: session.client?.deviceType ?? "unknown",
          operatingSystem: session.client?.operatingSystem
            ? {
                name: session.client.operatingSystem.name,
                version: session.client.operatingSystem.version ?? null,
              }
            : null,
        },
        network: {
          ipAddress: session.network?.ipAddress ?? null,
          location: session.network?.location
            ? {
                country: session.network.location.country,
                region: session.network.location.region ?? null,
                city: session.network.location.city ?? null,
                approximate: true,
              }
            : null,
        },
      })),
    );
  }
}
