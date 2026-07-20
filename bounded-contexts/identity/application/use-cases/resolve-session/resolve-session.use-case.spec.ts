// @file bounded-contexts/identity/application/use-cases/resolve-session/resolve-session.use-case.spec.ts

import { beforeEach, describe, expect, it } from "vitest";

import type { SessionPort } from "#application/ports/session.port";
import type { UserPort } from "#application/ports/user.port";
import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { StatusValueObject } from "#value-objects/status.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ResolveSessionUseCase } from "./resolve-session.use-case.js";

/* -------------------------------------------------------------------------- */
/*                                FAKE USER PORT                              */
/* -------------------------------------------------------------------------- */

class FakeUserPort implements UserPort {
  private readonly users = new Map<string, UserEntity>();

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async findByEmail(): Promise<UserEntity | null> {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                              FAKE SESSION PORT                             */
/* -------------------------------------------------------------------------- */

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
}

/* -------------------------------------------------------------------------- */

describe("ResolveSessionUseCase", () => {
  let sessionPort: FakeSessionPort;
  let userPort: FakeUserPort;
  let useCase: ResolveSessionUseCase;

  beforeEach(() => {
    sessionPort = new FakeSessionPort();
    userPort = new FakeUserPort();

    useCase = new ResolveSessionUseCase(sessionPort, userPort);
  });

  /* ---------------------------------------------------------------------- */
  /* EMPTY SESSION ID                                                       */
  /* ---------------------------------------------------------------------- */

  it("should fail when sessionId is empty", async () => {
    const result = await useCase.execute({
      sessionId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "session.unauthorized",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* INVALID SESSION ID                                                     */
  /* ---------------------------------------------------------------------- */

  it("should fail when sessionId is invalid", async () => {
    const result = await useCase.execute({
      sessionId: "invalid-session-id",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "session.unauthorized",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* SESSION NOT FOUND                                                      */
  /* ---------------------------------------------------------------------- */

  it("should fail when session does not exist", async () => {
    const sessionId = SessionIdentifierValueObject.generate();

    const result = await useCase.execute({
      sessionId: sessionId.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "session.unauthorized",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* USER NOT FOUND                                                         */
  /* ---------------------------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.createForUser({
      userId,
    });

    await sessionPort.create(session);

    const result = await useCase.execute({
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "session.unauthorized",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* EXPIRED SESSION                                                        */
  /* ---------------------------------------------------------------------- */

  it("should fail when session is expired", async () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.rehydrate({
      identifier: SessionIdentifierValueObject.generate(),
      userId,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await sessionPort.create(session);

    const email = EmailValueObject.create("john@doe.com");
    if (!email.success) {
      throw new Error("Invalid email");
    }

    const password = PasswordHashValueObject.create("hashed-password");
    if (!password.success) {
      throw new Error("Invalid password");
    }

    const user = UserEntity.rehydrate({
      identifier: userId,
      email: email.value,
      password: password.value,
      status: StatusValueObject.active(),
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userPort.save(user);

    const result = await useCase.execute({
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "session.unauthorized",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* SUCCESS                                                                */
  /* ---------------------------------------------------------------------- */

  it("should resolve a valid session", async () => {
    const userId = UserIdentifierValueObject.generate();

    const email = EmailValueObject.create("john@doe.com");
    if (!email.success) {
      throw new Error("Invalid email");
    }

    const password = PasswordHashValueObject.create("hashed-password");
    if (!password.success) {
      throw new Error("Invalid password");
    }

    const user = UserEntity.rehydrate({
      identifier: userId,
      email: email.value,
      password: password.value,
      status: StatusValueObject.active(),
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userPort.save(user);

    const session = SessionEntity.createForUser({
      userId,
    });

    await sessionPort.create(session);

    const result = await useCase.execute({
      sessionId: session.identifier.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        userId: user.identifier.value,
        sessionId: session.identifier.value,
      });
    }
  });
});
