// @file bounded-contexts/iam/application/use-cases/verify-email/verify-email.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { UserEntity } from "#entities/user.entity";
import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { VerifyEmailUseCase } from "./verify-email.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
  private readonly users = new Map<string, UserEntity>();

  async findByEmail(_email: EmailValueObject): Promise<UserEntity | null> {
    return null;
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }
}

/* ---------------- FAKE EMAIL VERIFICATION PORT ---------------- */

class FakeEmailVerificationPort implements EmailVerificationRepository {
  private readonly records = new Map<string, EmailVerificationEntity>();

  async save(verification: EmailVerificationEntity): Promise<void>;
  async save(
    userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void>;
  async save(
    verificationOrUserId: EmailVerificationEntity | UserIdentifierValueObject,
    rawToken?: string,
    expiresAt?: Date,
  ): Promise<void> {
    if (verificationOrUserId instanceof EmailVerificationEntity) {
      this.records.set(
        verificationOrUserId.tokenHash.value,
        verificationOrUserId,
      );
      return;
    }

    const token = EmailVerificationTokenValueObject.create(rawToken ?? "");
    if (!token.success || !expiresAt) {
      throw new Error("Invalid verification");
    }
    const verification = EmailVerificationEntity.create({
      userId: verificationOrUserId,
      tokenHash: FakeTokenHasher.hashValue(),
      expiresAt,
    });
    this.records.set(verification.tokenHash.value, verification);
  }

  async findByToken(
    token: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null>;
  async findByToken(
    token: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null> {
    return this.records.get(token.value) ?? null;
  }

  async consume(
    token: EmailVerificationTokenHashValueObject,
    now: Date,
  ): Promise<boolean> {
    const verification = this.records.get(token.value);
    if (!verification?.isUsableAt(now)) {
      return false;
    }
    verification.consume();
    return true;
  }

  async markUsed(_token: string): Promise<void> {
    await this.consume(FakeTokenHasher.hashValue(), new Date());
  }

  async invalidatePreviousFor(
    _userId: UserIdentifierValueObject,
  ): Promise<void> {
    return;
  }
}

class FakeTokenHasher {
  static hashValue(): EmailVerificationTokenHashValueObject {
    const result = EmailVerificationTokenHashValueObject.create("a".repeat(64));
    if (!result.success) {
      throw new Error("Invalid hash");
    }
    return result.value;
  }

  async hash(): Promise<EmailVerificationTokenHashValueObject> {
    return FakeTokenHasher.hashValue();
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("VerifyEmailUseCase", () => {
  let userPort: FakeUserPort;
  let emailVerificationPort: FakeEmailVerificationPort;
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    emailVerificationPort = new FakeEmailVerificationPort();
    useCase = new VerifyEmailUseCase(
      userPort,
      emailVerificationPort,
      new FakeTokenHasher(),
    );
  });

  /* -------------------------------------------------- */
  /* 1. TOKEN NOT FOUND                                 */
  /* -------------------------------------------------- */

  it("should fail when token does not exist", async () => {
    const result = await useCase.execute({
      token: "non-existent-token",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "token.invalid",
      });
    }
  });

  it("should fail when a valid token has no matching verification", async () => {
    const result = await useCase.execute({
      token: EmailVerificationTokenValueObject.generate().value,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "token.invalid" },
    });
  });

  it("should fail when a concurrent consumption does not update the verification", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }
    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });
    await userPort.save(user);
    await emailVerificationPort.save(
      EmailVerificationEntity.create({
        userId: user.identifier,
        tokenHash: FakeTokenHasher.hashValue(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
    vi.spyOn(emailVerificationPort, "consume").mockResolvedValue(false);

    await expect(
      useCase.execute({
        token: EmailVerificationTokenValueObject.generate().value,
      }),
    ).resolves.toEqual({
      success: false,
      error: { code: "token.invalid" },
    });
  });

  /* -------------------------------------------------- */
  /* 2. TOKEN ALREADY USED                              */
  /* -------------------------------------------------- */

  it("should fail when token is already used", async () => {
    const email = EmailValueObject.create("test@test.com");
    if (!email.success) {
      throw new Error("Invalid email");
    }

    const password = PasswordHashValueObject.create("hashed-password");
    if (!password.success) {
      throw new Error("Invalid password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);
    await emailVerificationPort.markUsed(token);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "token.invalid",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 3. TOKEN EXPIRED                                   */
  /* -------------------------------------------------- */

  it("should fail when token is expired", async () => {
    const email = EmailValueObject.create("test@test.com");
    if (!email.success) {
      throw new Error("Invalid email");
    }

    const password = PasswordHashValueObject.create("hashed-password");
    if (!password.success) {
      throw new Error("Invalid password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() - 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "token.expired",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const userId = UserIdentifierValueObject.generate();

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(userId, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 5. SUCCESS CASE                                    */
  /* -------------------------------------------------- */

  it("should verify email successfully", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser?.isEmailVerified).toBe(true);
    expect(updatedUser?.status.isActive()).toBe(true);
  });

  /* -------------------------------------------------- */
  /* 6. MARK USED CALLED                               */
  /* -------------------------------------------------- */

  it("should call markUsed on email verification port", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);

    const spy = vi.spyOn(emailVerificationPort, "consume");

    await useCase.execute({ token });

    expect(spy).toHaveBeenCalled();
  });

  /* -------------------------------------------------- */
  /* 7. SAVE CALLED                                     */
  /* -------------------------------------------------- */

  it("should call save on user port", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);

    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({ token });

    expect(spy).toHaveBeenCalled();
  });

  /* -------------------------------------------------- */
  /* 8. EMAIL ALREADY VERIFIED                          */
  /* -------------------------------------------------- */

  it("should succeed when email is already verified", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.verifyEmail();

    await userPort.save(user);

    const token = EmailVerificationTokenValueObject.generate().value;
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.save(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(true);
  });
});
