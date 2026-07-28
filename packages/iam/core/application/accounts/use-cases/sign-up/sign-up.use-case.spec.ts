// @file bounded-contexts/iam/application/use-cases/sign-up/sign-up.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPasswordPolicy } from "#domain/password-policy";
import { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { UserEntity } from "#entities/user.entity";
import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import { PasswordPolicyValidator } from "#services/password-policy-validator.service";
import type {
  CommonPasswordChecker,
  CompromisedPasswordChecker,
  PasswordStrengthEvaluator,
} from "#services/password-security.service";
import type { EmailValueObject } from "#value-objects/email.value-object";
import type { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SignUpUseCase } from "./sign-up.use-case.js";

/* ---------------- FAKE EMAIL VERIFICATION PORT ---------------- */

class FakeEmailVerificationPort implements EmailVerificationRepository {
  public lastToken?: string;

  async save(verification: EmailVerificationEntity): Promise<void> {
    this.lastToken = verification.tokenHash.value;
  }

  async findByToken(
    _token: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    return null;
  }

  async consume(
    _token: EmailVerificationTokenHashValueObject,
    _now: Date,
  ): Promise<boolean> {
    return false;
  }

  async invalidatePreviousFor(
    _userId: UserIdentifierValueObject,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

/* ---------------- FAKE EMAIL SENDER ---------------- */

class FakeEmailSenderPort implements EmailSender {
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

class FakeTokenHasher implements EmailVerificationTokenHasher {
  async hash(
    _token: EmailVerificationTokenValueObject,
  ): Promise<EmailVerificationTokenHashValueObject> {
    const result = EmailVerificationTokenHashValueObject.create("a".repeat(64));
    if (!result.success) {
      throw new Error("Invalid hash");
    }
    return result.value;
  }
}

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
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
      new FakeTokenHasher(),
      new PasswordPolicyValidator(
        createPasswordPolicy("elevated", {
          checkCommonPasswords: false,
          checkCompromisedPasswords: false,
          checkUserContext: false,
        }),
        {
          evaluate: async () => "acceptable",
        } as PasswordStrengthEvaluator,
        { isCommon: async () => false } as CommonPasswordChecker,
        { isCompromised: async () => false } as CompromisedPasswordChecker,
      ),
    );
  });

  /* -------------------------------------------------- */
  /* 1. SUCCESS PATH                                   */
  /* -------------------------------------------------- */

  it("should register user successfully", async () => {
    const result = await useCase.execute({
      email: "test@test.com",
      password: "a secure phrase 123",
      passwordConfirmation: "a secure phrase 123",
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
      password: "a secure phrase 123",
      passwordConfirmation: "a secure phrase 123",
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
      passwordConfirmation: "",
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
      password: "a secure phrase 123",
      passwordConfirmation: "a secure phrase 123",
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
      password: "a secure phrase 123",
      passwordConfirmation: "a secure phrase 123",
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
      password: "a secure phrase 123",
      passwordConfirmation: "a secure phrase 123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  it("rejects a mismatched password confirmation before hashing", async () => {
    const spy = vi.spyOn(passwordHasher, "hash");
    const result = await useCase.execute({
      email: "test@test.com",
      password: "a secure phrase 123",
      passwordConfirmation: "another secure phrase",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "password.confirmation_mismatch" },
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("accepts Unicode passphrases and spaces", async () => {
    const password = "Une très longue phrase 🔐 unique";
    const result = await useCase.execute({
      email: "unicode@test.com",
      password,
      passwordConfirmation: password,
    });

    expect(result.success).toBe(true);
  });
});
