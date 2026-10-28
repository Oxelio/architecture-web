import { Result } from "@architecture/foundation";

import type { SessionPolicyReader } from "#authentication/authentication-policy.reader";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListCurrentUserSessionsErrorCodes } from "./list-current-user-sessions.codes.js";
import type {
  CurrentUserSession,
  ListCurrentUserSessions,
  ListCurrentUserSessionsInput,
  ListCurrentUserSessionsOutput,
} from "./list-current-user-sessions.contracts.js";

export class ListCurrentUserSessionsUseCase implements ListCurrentUserSessions {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
  ) {}

  async execute(
    input: ListCurrentUserSessionsInput,
  ): Promise<ListCurrentUserSessionsOutput> {
    if (!(await this.policies.getSessionPolicy()).userManagement) {
      return Result.failure(ListCurrentUserSessionsErrorCodes.featureDisabled);
    }
    const actorId = UserIdentifierValueObject.create(input.actorUserId);
    if (!actorId.success) {
      return Result.failure(ListCurrentUserSessionsErrorCodes.invalidActorId);
    }

    if (!(await this.users.findById(actorId.value))) {
      return Result.failure(ListCurrentUserSessionsErrorCodes.userNotFound);
    }

    const sessions = await this.sessions.findActiveForUser(actorId.value);
    return Result.success(
      sessions.map((session): CurrentUserSession => ({
        sessionId: session.identifier.value,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
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
              }
            : null,
        },
      })),
    );
  }
}
