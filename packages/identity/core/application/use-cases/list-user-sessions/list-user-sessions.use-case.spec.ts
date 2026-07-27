import { describe, expect, it } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import type { SessionAdministrationRepository } from "#repositories/session.repository";
import type { UserAdministrationRepository } from "#repositories/user.repository";
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
    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });
    const session = SessionEntity.createForUser({ userId: user.identifier });
    const users = {
      findById: async () => user,
    } as unknown as UserAdministrationRepository;
    const sessions = {
      findAllForUser: async () => [session],
      findById: async (_id: SessionIdentifierValueObject) => session,
    } as unknown as SessionAdministrationRepository;

    const result = await new ListUserSessionsUseCase(users, sessions).execute({
      userId: user.identifier.value,
    });

    expect(result).toEqual({
      success: true,
      value: [
        {
          sessionId: session.identifier.value,
          expiresAt: session.expiresAt.toISOString(),
        },
      ],
    });
  });

  it("rejects an unknown user", async () => {
    const users = {
      findById: async (_id: UserIdentifierValueObject) => null,
    } as unknown as UserAdministrationRepository;
    const result = await new ListUserSessionsUseCase(users, {
      findAllForUser: async () => [],
    } as unknown as SessionAdministrationRepository).execute({
      userId: "01900000-0000-7000-8000-000000000000",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user.not_found" },
    });
  });
});
