import { Result } from "@architecture/foundation";

import type { SessionSummary } from "#models/session-summary";
import type { SessionAdministrationRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListCurrentUserSessionsErrorCodes } from "./list-current-user-sessions.codes.js";
import type {
  ListCurrentUserSessions,
  ListCurrentUserSessionsInput,
  ListCurrentUserSessionsOutput,
} from "./list-current-user-sessions.contracts.js";

export class ListCurrentUserSessionsUseCase implements ListCurrentUserSessions {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionAdministrationRepository,
  ) {}

  async execute(
    input: ListCurrentUserSessionsInput,
  ): Promise<ListCurrentUserSessionsOutput> {
    const actorId = UserIdentifierValueObject.create(input.actorUserId);
    if (!actorId.success) {
      return Result.failure(ListCurrentUserSessionsErrorCodes.invalidActorId);
    }

    if (!(await this.users.findById(actorId.value))) {
      return Result.failure(ListCurrentUserSessionsErrorCodes.userNotFound);
    }

    const sessions = await this.sessions.findAllForUser(actorId.value);
    return Result.success(
      sessions.map((session): SessionSummary => ({
        userId: session.userId.value,
        sessionId: session.identifier.value,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
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
