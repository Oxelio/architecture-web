// @file bounded-contexts/identity/application/use-cases/sign-in/sign-in.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionEntity } from "../../../domain/entities/session.entity.js";
import { UserEntity } from "../../../domain/entities/user.entity.js";
import { EmailValueObject } from "../../../domain/value-objects/email.value-object.js";
import { PasswordHashValueObject } from "../../../domain/value-objects/password-hash.value-object.js";
import { PasswordPlainValueObject } from "../../../domain/value-objects/password-plain.value-object.js";
import type { SessionIdentifierValueObject } from "../../../domain/value-objects/session-identifier.value-object.js";
import type { UserIdentifierValueObject } from "../../../domain/value-objects/user-identifier.value-object.js";
import type { PasswordHasherPort } from "../../ports/password-hasher.port.js";
import type { SessionPort } from "../../ports/session.port.js";
import { SignInUseCase } from "./sign-in.use-case.js";

/* -------------------------------------------------------------------------- */
/*                                FAKE USER PORT                              */
/* -------------------------------------------------------------------------- */

class FakeUserPort {
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

class FakePasswordHasherPort implements PasswordHasherPort {
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

    useCase = new SignInUseCase(userPort, passwordHasher, sessionPort);
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
      expect(result.value.data.userId).toBe(user.identifier.value);

      expect(result.value.data.sessionId).toBeDefined();
      expect(result.value.data.sessionExpiresAt).toBeInstanceOf(Date);
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
    });

    expect(sessionPort.count()).toBe(1);
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
