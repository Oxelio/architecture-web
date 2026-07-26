// @file bounded-contexts/identity/application/use-cases/resend-email-verification/resend-email-verification.use-case.spec.ts

import { beforeEach, describe, expect, it } from "vitest";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { UserEntity } from "#entities/user.entity";
import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationRateLimiter } from "#services/email-verification-rate-limiter.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import { EmailValueObject } from "#value-objects/email.value-object";
import type { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { StatusValueObject } from "#value-objects/status.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ResendEmailVerificationUseCase } from "./resend-email-verification.use-case.js";

/* -------------------------------------------------------------------------- */
/*                                FAKE USER PORT                              */
/* -------------------------------------------------------------------------- */

class FakeUserPort implements UserRepository {
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
/*                      FAKE EMAIL VERIFICATION PORT                           */
/* -------------------------------------------------------------------------- */

class FakeEmailVerificationPort implements EmailVerificationRepository {
  async save(verification: EmailVerificationEntity): Promise<void> {
    this.created = true;
    this.token = verification.tokenHash.value;
    this.expiresAt = verification.expiresAt;
  }
  async findByToken(
    _token: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    throw new Error("Method not implemented.");
  }
  async consume(
    _token: EmailVerificationTokenHashValueObject,
    _now: Date,
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public invalidated = false;

  public created = false;

  public token: string | null = null;

  public expiresAt: Date | null = null;

  async invalidatePreviousFor(): Promise<void> {
    this.invalidated = true;
  }
}

/* -------------------------------------------------------------------------- */
/*                          FAKE EMAIL SENDER PORT                            */
/* -------------------------------------------------------------------------- */

class FakeEmailSenderPort implements EmailSender {
  public sent = false;

  public email: string | null = null;

  public token: string | null = null;

  async sendVerificationEmail(
    email: EmailValueObject,
    token: string,
  ): Promise<void> {
    this.sent = true;
    this.email = email.value;
    this.token = token;
  }
}

/* -------------------------------------------------------------------------- */
/*                        FAKE RATE LIMIT PORT                                */
/* -------------------------------------------------------------------------- */

class FakeRateLimitPort implements EmailVerificationRateLimiter {
  public allowed = true;

  public registerCalled = false;

  async isAllowed(): Promise<boolean> {
    return this.allowed;
  }

  async recordSuccess(): Promise<void> {
    this.registerCalled = true;
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

/* -------------------------------------------------------------------------- */

describe("ResendEmailVerificationUseCase", () => {
  let userPort: FakeUserPort;
  let emailVerification: FakeEmailVerificationPort;
  let emailSender: FakeEmailSenderPort;
  let rateLimit: FakeRateLimitPort;

  let useCase: ResendEmailVerificationUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    emailVerification = new FakeEmailVerificationPort();
    emailSender = new FakeEmailSenderPort();
    rateLimit = new FakeRateLimitPort();

    useCase = new ResendEmailVerificationUseCase(
      userPort,
      emailVerification,
      emailSender,
      rateLimit,
      new FakeTokenHasher(),
    );
  });

  async function createUser(isEmailVerified = false): Promise<UserEntity> {
    const email = EmailValueObject.create("john@doe.com");
    if (!email.success) {
      throw new Error("Invalid email");
    }

    const password = PasswordHashValueObject.create("hashed-password");
    if (!password.success) {
      throw new Error("Invalid password");
    }

    const user = UserEntity.rehydrate({
      identifier: UserIdentifierValueObject.generate(),
      email: email.value,
      password: password.value,
      status: StatusValueObject.active(),
      isEmailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userPort.save(user);

    return user;
  }

  /* ---------------------------------------------------------------------- */
  /* EMPTY USER ID                                                          */
  /* ---------------------------------------------------------------------- */

  it("should fail when userId is empty", async () => {
    const result = await useCase.execute({
      userId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* INVALID USER ID                                                        */
  /* ---------------------------------------------------------------------- */

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      userId: "invalid-user-id",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* USER NOT FOUND                                                         */
  /* ---------------------------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const result = await useCase.execute({
      userId: UserIdentifierValueObject.generate().value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* EMAIL ALREADY VERIFIED                                                 */
  /* ---------------------------------------------------------------------- */

  it("should fail when email is already verified", async () => {
    const user = await createUser(true);

    const result = await useCase.execute({
      userId: user.identifier.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.email_already_verified",
      });
    }
  });

  /* ---------------------------------------------------------------------- */
  /* TOO MANY REQUESTS                                                      */
  /* ---------------------------------------------------------------------- */

  it("should fail when rate limit is reached", async () => {
    const user = await createUser(false);

    rateLimit.allowed = false;

    const result = await useCase.execute({
      userId: user.identifier.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "email_verification.too_many_requests",
      });
    }

    expect(emailVerification.created).toBe(false);
    expect(emailSender.sent).toBe(false);
    expect(rateLimit.registerCalled).toBe(false);
  });

  /* ---------------------------------------------------------------------- */
  /* SUCCESS                                                                */
  /* ---------------------------------------------------------------------- */

  it("should resend verification email", async () => {
    const user = await createUser(false);

    const result = await useCase.execute({
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }

    expect(emailVerification.invalidated).toBe(true);

    expect(emailVerification.created).toBe(true);
    expect(emailVerification.token).toBeTruthy();
    expect(emailVerification.expiresAt).toBeInstanceOf(Date);

    expect(emailSender.sent).toBe(true);
    expect(emailSender.email).toBe(user.email.value);
    expect(emailSender.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(emailSender.token).not.toBe(emailVerification.token);

    expect(rateLimit.registerCalled).toBe(true);
  });
});
