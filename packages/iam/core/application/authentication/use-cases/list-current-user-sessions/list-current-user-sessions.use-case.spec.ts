import { describe, expect, it } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import type { SessionListingRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
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
    const actor = UserEntity.create({
      email: email.value,
      password: password.value,
    });
    const session = SessionEntity.createForUser({
      userId: actor.identifier,
    });
    const users = {
      findById: async () => actor,
    } as unknown as UserRepository;
    const sessions = {
      findActiveForUser: async () => [session],
    } as unknown as SessionListingRepository;

    const result = await new ListCurrentUserSessionsUseCase(
      users,
      sessions,
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
