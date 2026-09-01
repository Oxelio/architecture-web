import { describe, expect, it, vi } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import type { SessionRepository } from "#repositories/session.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { RevokeCurrentUserSessionUseCase } from "./revoke-current-user-session.use-case.js";

describe("RevokeCurrentUserSessionUseCase", () => {
  it("revokes only a session owned by the authenticated actor", async () => {
    const actorId = UserIdentifierValueObject.generate();
    const session = SessionEntity.createForUser({
      userId: actorId,
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const deleteSession = vi.fn();
    const sessions = {
      findById: async () => session,
      delete: deleteSession,
    } as unknown as SessionRepository;

    const result = await new RevokeCurrentUserSessionUseCase(sessions).execute({
      actorUserId: actorId.value,
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    expect(deleteSession).toHaveBeenCalledWith(session.identifier);
  });

  it("hides a session owned by another user", async () => {
    const session = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const sessions = {
      findById: async () => session,
      delete: vi.fn(),
    } as unknown as SessionRepository;

    const result = await new RevokeCurrentUserSessionUseCase(sessions).execute({
      actorUserId: UserIdentifierValueObject.generate().value,
      sessionId: session.identifier.value,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "session.not_found" },
    });
  });
});
