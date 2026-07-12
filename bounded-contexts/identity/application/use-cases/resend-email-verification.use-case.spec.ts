import type { EmailSenderPort } from "#application/ports/email-sender.port";
import type { EmailVerificationRateLimitPort } from "#application/ports/email-verification-rate-limit.port";
import type {
  EmailVerificationPort,
  EmailVerificationRecord,
} from "#application/ports/email-verification.port";
import type { UserPort } from "#application/ports/user.port";
import { UserEntity } from "#entities/user.entity";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { StatusValueObject } from "#value-objects/status.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { beforeEach, describe, expect, it } from "vitest";
import { ResendEmailVerificationUseCase } from "./resend-email-verification.use-case.js";

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
/*                      FAKE EMAIL VERIFICATION PORT                           */
/* -------------------------------------------------------------------------- */

class FakeEmailVerificationPort implements EmailVerificationPort {
  async findByToken(_token: string): Promise<EmailVerificationRecord | null> {
    throw new Error("Method not implemented.");
  }
  async markUsed(_token: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public invalidated = false;

  public created = false;

  public token: string | null = null;

  public expiresAt: Date | null = null;

  async invalidatePrevious(): Promise<void> {
    this.invalidated = true;
  }

  async create(
    _userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.created = true;
    this.token = token;
    this.expiresAt = expiresAt;
  }
}

/* -------------------------------------------------------------------------- */
/*                          FAKE EMAIL SENDER PORT                            */
/* -------------------------------------------------------------------------- */

class FakeEmailSenderPort implements EmailSenderPort {
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

class FakeRateLimitPort implements EmailVerificationRateLimitPort {
  public allowed = true;

  public registerCalled = false;

  async canSend(): Promise<boolean> {
    return this.allowed;
  }

  async registerSend(): Promise<void> {
    this.registerCalled = true;
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
        code: "user.not_found",
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
        code: "user.not_found",
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
      expect(result.value).toEqual({
        sent: true,
      });
    }

    expect(emailVerification.invalidated).toBe(true);

    expect(emailVerification.created).toBe(true);
    expect(emailVerification.token).toBeTruthy();
    expect(emailVerification.expiresAt).toBeInstanceOf(Date);

    expect(emailSender.sent).toBe(true);
    expect(emailSender.email).toBe(user.email.value);
    expect(emailSender.token).toBe(emailVerification.token);

    expect(rateLimit.registerCalled).toBe(true);
  });
});
