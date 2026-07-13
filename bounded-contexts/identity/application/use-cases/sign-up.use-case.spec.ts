// @file bounded-contexts/identity/application/use-cases/sign-up.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailSenderPort } from "#application/ports/email-sender.port";
import type {
  EmailVerificationPort,
  EmailVerificationRecord,
} from "#application/ports/email-verification.port";
import type { UserPort } from "#application/ports/user.port";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { UserEntity } from "../../domain/entities/user.entity.js";
import { EmailValueObject } from "../../domain/value-objects/email.value-object.js";
import { PasswordHashValueObject } from "../../domain/value-objects/password-hash.value-object.js";
import { PasswordPlainValueObject } from "../../domain/value-objects/password-plain.value-object.js";
import { SignUpUseCase } from "./sign-up.use-case.js";

/* ---------------- FAKE EMAIL VERIFICATION PORT ---------------- */

class FakeEmailVerificationPort implements EmailVerificationPort {
  public lastToken?: string;

  async create(
    _userId: UserIdentifierValueObject,
    token: string,
    _expiresAt: Date,
  ): Promise<void> {
    this.lastToken = token;
  }

  async findByToken(_token: string): Promise<EmailVerificationRecord | null> {
    return null;
  }

  async markUsed(): Promise<void> {
    return;
  }

  async invalidatePrevious(_userId: UserIdentifierValueObject): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

/* ---------------- FAKE EMAIL SENDER ---------------- */

class FakeEmailSenderPort implements EmailSenderPort {
  public lastSent?: {
    to: string;
    token: string;
  };

  async sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void> {
    this.lastSent = {
      to: to.value,
      token,
    };
  }

  async send(): Promise<void> {
    return;
  }
}

/* ---------------- FAKE PASSWORD HASHER ---------------- */

class FakePasswordHasherPort {
  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const result = PasswordHashValueObject.create("hashed-" + password.value);

    if (!result.success) {
      throw new Error("Invalid hash");
    }

    return result.value;
  }

  async verify() {
    return true;
  }

  async fakeVerify() {
    throw new Error("Method not implemented.");
  }
}

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserPort {
  private readonly usersByEmail = new Map<string, UserEntity>();
  private readonly usersById = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.usersByEmail.get(email.value) ?? null;
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.usersById.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.usersByEmail.set(user.email.value, user);
    this.usersById.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("SignUpUseCase - full coverage", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let emailVerificationPort: FakeEmailVerificationPort;
  let emailSenderPort: FakeEmailSenderPort;
  let useCase: SignUpUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    emailVerificationPort = new FakeEmailVerificationPort();
    emailSenderPort = new FakeEmailSenderPort();
    useCase = new SignUpUseCase(
      userPort,
      passwordHasher,
      emailVerificationPort,
      emailSenderPort,
    );
  });

  /* -------------------------------------------------- */
  /* 1. SUCCESS PATH                                   */
  /* -------------------------------------------------- */

  it("should register user successfully", async () => {
    const result = await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBeDefined();
      expect(emailVerificationPort.lastToken).toBeDefined();
      expect(emailSenderPort.lastSent).toBeDefined();
    }
  });

  /* -------------------------------------------------- */
  /* 2. EMAIL INVALID (COVER EMAIL BRANCH)             */
  /* -------------------------------------------------- */

  it("should fail when email is invalid", async () => {
    const result = await useCase.execute({
      email: "invalid-email",
      password: "password123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("email.invalid_format");
    }
  });

  /* -------------------------------------------------- */
  /* 3. PASSWORD INVALID (COVER PASSWORD BRANCH)       */
  /* -------------------------------------------------- */

  it("should fail when password is invalid", async () => {
    const result = await useCase.execute({
      email: "test@test.com",
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("password.empty");
    }
  });

  /* -------------------------------------------------- */
  /* 4. USER ALREADY EXISTS                             */
  /* -------------------------------------------------- */

  it("should fail when user already exists", async () => {
    const payload = {
      email: "test@test.com",
      password: "password123",
    };

    // first insert
    await useCase.execute(payload);

    // second should fail
    const result = await useCase.execute(payload);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.already_exists",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 5. HASHER CALLED                                  */
  /* -------------------------------------------------- */

  it("should call password hasher", async () => {
    const spy = vi.spyOn(passwordHasher, "hash");

    await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 6. USER SAVED                                     */
  /* -------------------------------------------------- */

  it("should save user", async () => {
    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });
});
