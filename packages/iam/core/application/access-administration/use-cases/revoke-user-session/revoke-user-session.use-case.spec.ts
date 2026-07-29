import { describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { SessionEntity } from "#entities/session.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { RevokeUserSessionUseCase } from "./revoke-user-session.use-case.js";

describe("RevokeUserSessionUseCase", () => {
  it("revokes a session belonging to the target user", async () => {
    const userId = UserIdentifierValueObject.generate();
    const administrator = createAdministrator();
    const session = SessionEntity.createForUser({
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const deleteSession = vi.fn();
    const users = {
      findById: async (id: UserIdentifierValueObject) =>
        id.equals(administrator.identifier)
          ? administrator
          : { identifier: userId },
    } as unknown as UserRepository;
    const sessions = {
      findById: async () => session,
      delete: deleteSession,
    } as unknown as SessionRepository;

    const result = await new RevokeUserSessionUseCase(users, sessions).execute({
      actorUserId: administrator.identifier.value,
      userId: userId.value,
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    expect(deleteSession).toHaveBeenCalledWith(session.identifier);
  });

  it("does not reveal or revoke a session owned by another user", async () => {
    const userId = UserIdentifierValueObject.generate();
    const administrator = createAdministrator();
    const otherSession = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const deleteSession = vi.fn();
    const users = {
      findById: async (id: UserIdentifierValueObject) =>
        id.equals(administrator.identifier)
          ? administrator
          : { identifier: userId },
    } as unknown as UserRepository;
    const sessions = {
      findById: async () => otherSession,
      delete: deleteSession,
    } as unknown as SessionRepository;

    const result = await new RevokeUserSessionUseCase(users, sessions).execute({
      actorUserId: administrator.identifier.value,
      userId: userId.value,
      sessionId: otherSession.identifier.value,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "session.not_found" },
    });
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("revokes all sessions when no session is specified", async () => {
    const userId = UserIdentifierValueObject.generate();
    const administrator = createAdministrator();
    const deleteAll = vi.fn();
    const useCase = new RevokeUserSessionUseCase(
      {
        findById: async (id: UserIdentifierValueObject) =>
          id.equals(administrator.identifier)
            ? administrator
            : { identifier: userId },
      } as unknown as UserRepository,
      {
        deleteAllForUser: deleteAll,
      } as unknown as SessionRepository,
    );

    expect(
      await useCase.execute({
        actorUserId: administrator.identifier.value,
        userId: userId.value,
      }),
    ).toEqual({
      success: true,
      value: undefined,
    });
    expect(deleteAll).toHaveBeenCalledWith(userId);
  });
});
