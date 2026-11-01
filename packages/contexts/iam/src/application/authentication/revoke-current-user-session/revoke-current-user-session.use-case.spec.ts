import { describe, expect, it, vi } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import type { SessionRepository } from "#ports/session.repository";
import { TestPolicies } from "#test/test-policies";
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
    const append = vi.fn();
    const sessions = {
      findById: async () => session,
      delete: deleteSession,
    } as unknown as SessionRepository;

    const result = await new RevokeCurrentUserSessionUseCase(
      sessions,
      new TestPolicies(),
      { append },
    ).execute({
      actorUserId: actorId.value,
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    expect(deleteSession).toHaveBeenCalledWith(session.identifier);
    expect(append).toHaveBeenCalledWith([
      expect.objectContaining({
        topic: "iam.sessions-revoked",
        version: 1,
        payload: { userId: actorId.value, scope: "one" },
      }),
    ]);
    expect(JSON.stringify(append.mock.calls)).not.toContain(
      session.identifier.value,
    );
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

    const result = await new RevokeCurrentUserSessionUseCase(
      sessions,
      new TestPolicies(),
      { append: vi.fn() },
    ).execute({
      actorUserId: UserIdentifierValueObject.generate().value,
      sessionId: session.identifier.value,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "session.not_found" },
    });
  });
});
