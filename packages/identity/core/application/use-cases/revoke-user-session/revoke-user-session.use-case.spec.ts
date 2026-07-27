import { describe, expect, it, vi } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import type { SessionAdministrationRepository } from "#repositories/session.repository";
import type { UserAdministrationRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { RevokeUserSessionUseCase } from "./revoke-user-session.use-case.js";

describe("RevokeUserSessionUseCase", () => {
  it("revokes a session belonging to the target user", async () => {
    const userId = UserIdentifierValueObject.generate();
    const session = SessionEntity.createForUser({ userId });
    const deleteSession = vi.fn();
    const users = {
      findById: async () => ({ identifier: userId }),
    } as unknown as UserAdministrationRepository;
    const sessions = {
      findById: async () => session,
      delete: deleteSession,
    } as unknown as SessionAdministrationRepository;

    const result = await new RevokeUserSessionUseCase(users, sessions).execute({
      userId: userId.value,
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    expect(deleteSession).toHaveBeenCalledWith(session.identifier);
  });

  it("does not reveal or revoke a session owned by another user", async () => {
    const userId = UserIdentifierValueObject.generate();
    const otherSession = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
    });
    const deleteSession = vi.fn();
    const users = {
      findById: async () => ({ identifier: userId }),
    } as unknown as UserAdministrationRepository;
    const sessions = {
      findById: async () => otherSession,
      delete: deleteSession,
    } as unknown as SessionAdministrationRepository;

    const result = await new RevokeUserSessionUseCase(users, sessions).execute({
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
    const deleteAll = vi.fn();
    const useCase = new RevokeUserSessionUseCase(
      {
        findById: async () => ({ identifier: userId }),
      } as unknown as UserAdministrationRepository,
      {
        deleteAllForUser: deleteAll,
      } as unknown as SessionAdministrationRepository,
    );

    expect(await useCase.execute({ userId: userId.value })).toEqual({
      success: true,
      value: undefined,
    });
    expect(deleteAll).toHaveBeenCalledWith(userId);
  });
});
