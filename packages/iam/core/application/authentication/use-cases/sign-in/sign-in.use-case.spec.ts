// @file bounded-contexts/iam/application/use-cases/sign-in/sign-in.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { PasswordHasher } from "#services/password-hasher.service";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SignInUseCase } from "./sign-in.use-case.js";

/* -------------------------------------------------------------------------- */
/*                                FAKE USER PORT                              */
/* -------------------------------------------------------------------------- */

class FakeUserPort implements UserRepository {
  async search(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
  async getAdministrationOverview(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
  private readonly usersById = new Map<string, UserEntity>();
  private readonly usersByEmail = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.usersByEmail.get(email.value) ?? null;
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.usersById.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.usersById.set(user.identifier.value, user);
    this.usersByEmail.set(user.email.value, user);
  }
}

/* -------------------------------------------------------------------------- */
/*                             FAKE PASSWORD HASHER                           */
/* -------------------------------------------------------------------------- */

class FakePasswordHasherPort implements PasswordHasher {
  async hash(password: PasswordPlainValueObject) {
    const hash = PasswordHashValueObject.create("hashed-" + password.value);

    if (!hash.success) {
      throw new Error("Invalid hash");
    }

    return hash.value;
  }

  async verify(
    password: PasswordPlainValueObject,
    hashed: PasswordHashValueObject,
  ): Promise<boolean> {
    return hashed.value === "hashed-" + password.value;
  }

  async fakeVerify(): Promise<void> {
    // timing attack protection noop
  }
}

/* -------------------------------------------------------------------------- */
/*                              FAKE SESSION PORT                             */
/* -------------------------------------------------------------------------- */

class FakeSessionPort implements SessionRepository {
  async findActiveForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly SessionEntity[]> {
    return [...this.sessions.values()].filter((session) =>
      session.userId.equals(userId),
    );
  }
  private readonly sessions = new Map<string, SessionEntity>();

  async save(session: SessionEntity): Promise<void> {
    this.sessions.set(session.identifier.value, session);
  }

  async saveEnforcingMaximum(
    session: SessionEntity,
    maximumActiveSessions: number,
  ): Promise<void> {
    await this.save(session);
    const sessions = [...this.sessions.values()]
      .filter((candidate) => candidate.userId.equals(session.userId))
      .toSorted(
        (first, second) =>
          first.createdAt.getTime() - second.createdAt.getTime(),
      );
    for (const overflow of sessions.slice(
      0,
      Math.max(0, sessions.length - maximumActiveSessions),
    )) {
      this.sessions.delete(overflow.identifier.value);
    }
  }

  async findById(
    id: SessionIdentifierValueObject,
  ): Promise<SessionEntity | null> {
    return this.sessions.get(id.value) ?? null;
  }

  async delete(id: SessionIdentifierValueObject): Promise<void> {
    this.sessions.delete(id.value);
  }

  async deleteAllForUser(userId: UserIdentifierValueObject): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId.equals(userId)) {
        this.sessions.delete(id);
      }
    }
  }

  async updateLastActivity(): Promise<void> {
    return undefined;
  }

  count() {
    return this.sessions.size;
  }

  all(): readonly SessionEntity[] {
    return [...this.sessions.values()];
  }
}

/* -------------------------------------------------------------------------- */

describe("SignInUseCase", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let sessionPort: FakeSessionPort;
  let useCase: SignInUseCase;

  const validEmail = "test@test.com";
  const validPassword = "password123";

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    sessionPort = new FakeSessionPort();

    useCase = new SignInUseCase(userPort, passwordHasher, sessionPort, {
      getPasswordPolicy: async () => {
        throw new Error("Not used during sign-in");
      },
      getSessionDurationMinutes: async () => 60,
      isCapabilityEnabled: async () => true,
    });
  });

  /* ---------------------------------------------------------------------- */
  it("keeps the number of active sessions bounded by revoking the oldest", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);
    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }
    const user = UserEntity.create({
      email: emailVO.value,
      password: await passwordHasher.hash(passwordVO.value),
    });
    await userPort.save(user);
    for (let index = 0; index < 10; index += 1) {
      await sessionPort.save(
        SessionEntity.createForUser({
          userId: user.identifier,
          userSessionVersion: user.sessionVersion,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );
    }

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(true);
    expect(sessionPort.count()).toBe(10);
  });

  /* ---------------------------------------------------------------------- */
  /* 1. INVALID EMAIL                                                       */
  /* ---------------------------------------------------------------------- */

  it("should fail when email is invalid", async () => {
    const result = await useCase.execute({
      email: "invalid-email",
      password: validPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_credentials",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* 2. INVALID PASSWORD (VALUE OBJECT)                                     */
  /* ---------------------------------------------------------------------- */

  it("should fail when password is invalid", async () => {
    const result = await useCase.execute({
      email: validEmail,
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_credentials",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* 3. USER NOT FOUND + fakeVerify                                         */
  /* ---------------------------------------------------------------------- */

  it("should fail when user does not exist and call fakeVerify", async () => {
    const spy = vi.spyOn(passwordHasher, "fakeVerify");

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(false);

    expect(spy).toHaveBeenCalledOnce();

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_credentials",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* 4. WRONG PASSWORD                                                      */
  /* ---------------------------------------------------------------------- */

  it("should fail when password is incorrect", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }

    const hashed = await passwordHasher.hash(passwordVO.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hashed,
    });
    // ensure user is verified and active for authentication
    user.verifyEmail();
    user.activate();

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: "wrong-password",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_credentials",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* 5. VERIFY CALLED                                                       */
  /* ---------------------------------------------------------------------- */

  it("should call password verify when user exists", async () => {
    const spy = vi.spyOn(passwordHasher, "verify");

    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }

    const hashed = await passwordHasher.hash(passwordVO.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hashed,
    });
    // ensure user is verified and active for authentication
    user.verifyEmail();
    user.activate();

    await userPort.save(user);

    await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  /* ---------------------------------------------------------------------- */
  /* 6. SUCCESS AUTH                                                        */
  /* ---------------------------------------------------------------------- */

  it("should authenticate user and return session", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }

    const hashed = await passwordHasher.hash(passwordVO.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hashed,
    });
    // ensure user is verified and active for authentication
    user.verifyEmail();
    user.activate();

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBe(user.identifier.value);

      expect(result.value.sessionId).toBeDefined();
      expect(result.value.sessionExpiresAt).toBeInstanceOf(Date);
    }
  });

  it("uses the session duration supplied by the active policy", async () => {
    useCase = new SignInUseCase(userPort, passwordHasher, sessionPort, {
      getPasswordPolicy: async () => {
        throw new Error("Not used during sign-in");
      },
      getSessionDurationMinutes: async () => 180,
      isCapabilityEnabled: async () => true,
    });
    const email = EmailValueObject.create(validEmail);
    const password = PasswordPlainValueObject.create(validPassword);
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }
    const user = UserEntity.create({
      email: email.value,
      password: await passwordHasher.hash(password.value),
    });
    user.activate();
    await userPort.save(user);

    const before = Date.now();
    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const { sessionExpiresAt } = result.value;
      expect(sessionExpiresAt).not.toBeNull();
      if (sessionExpiresAt) {
        expect(sessionExpiresAt.getTime()).toBeGreaterThanOrEqual(
          before + 180 * 60_000,
        );
      }
    }
  });

  /* ---------------------------------------------------------------------- */
  /* 7. SESSION CREATED                                                     */
  /* ---------------------------------------------------------------------- */

  it("should create a session in session store", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }

    const hashed = await passwordHasher.hash(passwordVO.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hashed,
    });
    // ensure user is verified and active for authentication
    user.verifyEmail();
    user.activate();

    await userPort.save(user);

    expect(sessionPort.count()).toBe(0);

    await useCase.execute({
      email: validEmail,
      password: validPassword,
      client: {
        type: "browser",
        name: "Firefox",
        deviceType: "desktop",
      },
      network: { ipAddress: "192.0.2.10" },
    });

    expect(sessionPort.count()).toBe(1);
    expect(sessionPort.all()[0]?.client?.name).toBe("Firefox");
    expect(sessionPort.all()[0]?.network?.ipAddress).toBe("192.0.2.10");
  });

  /* ---------------------------------------------------------------------- */
  /* 8. USER SUSPENDED                                                      */
  /* ---------------------------------------------------------------------- */

  it("should fail when user is suspended", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    const passwordVO = PasswordPlainValueObject.create(validPassword);

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("Invalid VO");
    }

    const hashed = await passwordHasher.hash(passwordVO.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hashed,
    });

    // User must have valid credentials
    user.verifyEmail();

    // Put user in suspended state
    user.suspend();

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.suspended",
      });
    }
  });
});
