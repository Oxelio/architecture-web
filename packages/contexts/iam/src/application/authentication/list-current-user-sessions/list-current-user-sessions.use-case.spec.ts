import { describe, expect, it } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { TestPolicies } from "#test/test-policies";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";

import { ListCurrentUserSessionsUseCase } from "./list-current-user-sessions.use-case.js";

describe("ListCurrentUserSessionsUseCase", () => {
  it("derives the session owner from the authenticated actor", async () => {
    const email = EmailValueObject.create("actor@example.com");
    const password = PasswordHashValueObject.create("actor-hash");
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }
    const actor = UserEntity.create();
    const session = SessionEntity.createForUser({
      userId: actor.identifier,
      userSessionVersion: actor.sessionVersion,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const users = {
      findById: async () => actor,
    } as unknown as UserRepository;
    const sessions = {
      findActiveForUser: async () => [session],
    } as unknown as SessionRepository;

    const result = await new ListCurrentUserSessionsUseCase(
      users,
      sessions,
      new TestPolicies(),
    ).execute({
      actorUserId: actor.identifier.value,
      currentSessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toMatchObject({
        sessionId: session.identifier.value,
        isCurrent: true,
      });
      expect(result.value[0]).not.toHaveProperty("userId");
      expect(result.value[0]).not.toHaveProperty("isActive");
    }
  });
});
