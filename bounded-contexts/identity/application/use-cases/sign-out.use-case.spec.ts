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

  async findById(
    id: SessionIdentifierValueObject,
  ): Promise<SessionEntity | null> {
    return this.sessions.get(id.value) ?? null;
  }

  async delete(id: SessionIdentifierValueObject): Promise<void> {
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

  it("should do nothing when sessionId is empty", async () => {
    const deleteSpy = vi.spyOn(sessionPort, "delete");

    await useCase.execute({ sessionId: "" });

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("should delete session when sessionId is valid", async () => {
    const deleteSpy = vi.spyOn(sessionPort, "delete");

    const sessionId = SessionIdentifierValueObject.generate();

    await useCase.execute({
      sessionId: sessionId.value,
    });

    expect(deleteSpy).toHaveBeenCalledOnce();
  });

  it("should remove session from storage", async () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.createForUser({
      userId: userId,
    });

    await sessionPort.create(session);

    expect(sessionPort.count()).toBe(1);

    await useCase.execute({
      sessionId: session.identifier.value,
    });

    expect(sessionPort.count()).toBe(0);
  });
});
