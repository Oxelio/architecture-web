import { Result } from "@architecture/foundation";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { SessionPolicyReader } from "#authentication/authentication-policy.reader";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListUserSessionsErrorCodes } from "./list-user-sessions.codes.js";
import type {
  AdministeredUserSession,
  ListUserSessions,
  ListUserSessionsInput,
  ListUserSessionsOutput,
} from "./list-user-sessions.contracts.js";

export class ListUserSessionsUseCase implements ListUserSessions {
  private readonly authorizer: AdministratorAuthorizer;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly policies: SessionPolicyReader,
  ) {
    this.authorizer = new AdministratorAuthorizer(users);
  }

  async execute(input: ListUserSessionsInput): Promise<ListUserSessionsOutput> {
    const authorization = await this.authorizer.authorize(input.actorUserId);
    if (!authorization.success) {
      return authorization;
    }

    if (!(await this.policies.getSessionPolicy()).userManagement) {
      return Result.failure(ListUserSessionsErrorCodes.featureDisabled);
    }
    const userId = UserIdentifierValueObject.create(input.userId);
    if (!userId.success) {
      return Result.failure(ListUserSessionsErrorCodes.invalidUserId);
    }

    if (!(await this.users.findById(userId.value))) {
      return Result.failure(ListUserSessionsErrorCodes.userNotFound);
    }

    const sessions = await this.sessions.findActiveForUser(userId.value);
    return Result.success(
      sessions.map((session): AdministeredUserSession => ({
        sessionId: session.identifier.value,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
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
