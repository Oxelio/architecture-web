import { describe, it, expect, beforeEach, vi } from "vitest";

import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserEntity } from "#entities/user.entity";
import { AuthenticateUserUseCase } from "./authenticate-user.use-case.js";
import { SessionPort } from "#application/ports/session.port";
import type { SessionEntity } from "#entities/session.entity";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort {
  users = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.users.get(email.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.email.value, user);
  }
}

/* ---------------- FAKE PASSWORD HASHER ---------------- */

class FakePasswordHasherPort {
  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const hash = PasswordHashValueObject.create("hashed-" + password.value);
    if (!hash.success) {
      throw new Error("Invalid hashed password value object");
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
    // Do nothing
  }
}

/* ---------------- FAKE SESSION PORT ---------------- */

class FakeSessionPort extends SessionPort {
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

describe("AuthenticateUserUseCase", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let sessionPort: FakeSessionPort;
  let useCase: AuthenticateUserUseCase;

  const validEmail = "test@test.com";
  const validPassword = "password123";

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    sessionPort = new FakeSessionPort();

    useCase = new AuthenticateUserUseCase(
      userPort,
      passwordHasher,
      sessionPort,
    );
  });

  /* -------------------------------------------------- */
  /* 1. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist and call fakeVerify", async () => {
    const fakeSpy = vi.spyOn(passwordHasher, "fakeVerify");

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toStrictEqual({
        kind: "invalid_credentials",
      });
    }

    expect(fakeSpy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 2. WRONG PASSWORD                                  */
  /* -------------------------------------------------- */

  it("should fail when password is invalid", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const plain = PasswordPlainValueObject.create(validPassword);
    if (!plain.success) {
      throw new Error("Invalid password value object");
    }
    const hash = await passwordHasher.hash(plain.value);

    const user = UserEntity.create({
      email: emailVO.value,
      password: hash,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: "wrong-password",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "invalid_credentials",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 3. SUCCESS AUTH                                   */
  /* -------------------------------------------------- */

  it("should authenticate user successfully", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + validPassword,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBeDefined();
    }
  });

  /* -------------------------------------------------- */
  /* 4. VERIFY CALLED                                  */
  /* -------------------------------------------------- */

  it("should call password verify when user exists", async () => {
    const verifySpy = vi.spyOn(passwordHasher, "verify");

    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + validPassword,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    await userPort.save(user);

    await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(verifySpy).toHaveBeenCalledOnce();
  });
});
