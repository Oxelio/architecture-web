import { describe, it, expect, beforeEach, vi } from "vitest";

import { SignOutUseCase } from "./sign-out.use-case.js";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { SessionPort } from "#application/ports/session.port";
import { SessionEntity } from "#entities/session.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

/* ---------------- FAKE SESSION PORT ---------------- */

class FakeSessionPort implements SessionPort {
  private readonly sessions = new Map<string, SessionEntity>();

  async create(session: SessionEntity): Promise<void> {
    this.sessions.set(session.identifier.value, session);
  }

  async findById(id: any): Promise<SessionEntity | null> {
    return this.sessions.get(id.value) ?? null;
  }

  async delete(id: any): Promise<void> {
    this.sessions.delete(id.value);
  }

  count() {
    return this.sessions.size;
  }
}

describe("SignOutUseCase", () => {
  let sessionPort: FakeSessionPort;
  let useCase: SignOutUseCase;

  beforeEach(() => {
    sessionPort = new FakeSessionPort();
    useCase = new SignOutUseCase(sessionPort);
  });

  /* -------------------------------------------------- */
  /* 1. EMPTY SESSION ID                                */
  /* -------------------------------------------------- */

  it("should fail when sessionId is empty", async () => {
    const result = await useCase.execute({ sessionId: "" });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "invalid_session_id",
      });
    }

    expect(sessionPort.count()).toBe(0);
  });

  /* -------------------------------------------------- */
  /* 2. INVALID UUID CASE (VO rejection)               */
  /* -------------------------------------------------- */

  it("should fail when sessionId is invalid", async () => {
    const result = await useCase.execute({
      sessionId: "not-a-valid-uuid",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.kind).toBe("invalid_session_id");
    }

    expect(sessionPort.count()).toBe(0);
  });

  /* -------------------------------------------------- */
  /* 3. VALID DELETE                                   */
  /* -------------------------------------------------- */

  it("should delete session when sessionId is valid", async () => {
    const deleteSpy = vi.spyOn(sessionPort, "delete");

    const sessionId = SessionIdentifierValueObject.generate();

    const result = await useCase.execute({
      sessionId: sessionId.value,
    });

    expect(result.success).toBe(true);
    expect(deleteSpy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 4. ACTUAL STORAGE REMOVAL                         */
  /* -------------------------------------------------- */

  it("should remove session from storage", async () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.createForUser({
      userId,
    });

    await sessionPort.create(session);

    expect(sessionPort.count()).toBe(1);

    const result = await useCase.execute({
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);
    expect(sessionPort.count()).toBe(0);
  });
});
