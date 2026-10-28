import { describe, expect, it } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { TestPolicies } from "#testing/iam-test-doubles";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListUserSessionsUseCase } from "./list-user-sessions.use-case.js";

describe("ListUserSessionsUseCase", () => {
  it("lists only the requested user's active sessions", async () => {
    const email = EmailValueObject.create("user@example.com");
    const password = PasswordHashValueObject.create("hashed-password");
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }
    const user = UserEntity.create();
    const administrator = createAdministrator();
    const session = SessionEntity.createForUser({
      userId: user.identifier,
      userSessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const users = {
      findById: async (id: UserIdentifierValueObject) =>
        id.equals(administrator.identifier) ? administrator : user,
    } as unknown as UserRepository;
    const sessions = {
      findActiveForUser: async () => [session],
      findById: async (_id: SessionIdentifierValueObject) => session,
    } as unknown as SessionRepository;

    const result = await new ListUserSessionsUseCase(
      users,
      sessions,
      new TestPolicies(),
    ).execute({
      actorUserId: administrator.identifier.value,
      userId: user.identifier.value,
    });

    expect(result).toEqual({
      success: true,
      value: [
        {
          sessionId: session.identifier.value,
          createdAt: session.createdAt.toISOString(),
          lastActivityAt: session.lastActivityAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          client: {
            type: "unknown",
            name: null,
            version: null,
            deviceType: "unknown",
            operatingSystem: null,
          },
          network: {
            ipAddress: null,
            location: null,
          },
        },
      ],
    });
  });

  it("rejects an unknown user", async () => {
    const administrator = createAdministrator();
    const users = {
      findById: async (id: UserIdentifierValueObject) =>
        id.equals(administrator.identifier) ? administrator : null,
    } as unknown as UserRepository;
    const result = await new ListUserSessionsUseCase(
      users,
      {
        findActiveForUser: async () => [],
      } as unknown as SessionRepository,
      new TestPolicies(),
    ).execute({
      actorUserId: administrator.identifier.value,
      userId: "01900000-0000-7000-8000-000000000000",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user.not_found" },
    });
  });
});
