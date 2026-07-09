import { describe, it, expect, beforeEach, vi } from "vitest";

import { VerifyEmailUseCase } from "./verify-email.use-case.js";
import { UserIdentifierValueObject } from "../../domain/value-objects/user-identifier.value-object.js";
import { EmailValueObject } from "../../domain/value-objects/email.value-object.js";
import { PasswordHashValueObject } from "../../domain/value-objects/password-hash.value-object.js";
import { UserEntity } from "../../domain/entities/user.entity.js";
import type { UserPort } from "../ports/user.port.js";
import type { EmailVerificationPort } from "../ports/email-verification.port.js";
import type { EmailVerificationRecord } from "../ports/email-verification.port.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserPort {
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

class FakeEmailVerificationPort implements EmailVerificationPort {
  private readonly records = new Map<string, EmailVerificationRecord>();

  async create(
    userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    this.records.set(token, {
      token,
      userId,
      expiresAt,
      used: false,
    });
  }

  async findByToken(token: string): Promise<EmailVerificationRecord | null> {
    return this.records.get(token) ?? null;
  }

  async markUsed(token: string): Promise<void> {
    const record = this.records.get(token);

    if (record) {
      record.used = true;
    }
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
    useCase = new VerifyEmailUseCase(userPort, emailVerificationPort);
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
        kind: "token.invalid",
      });
    }
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

    const token = "used-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);
    await emailVerificationPort.markUsed(token);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "token.invalid",
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

    const token = "expired-token";
    const expiresAt = new Date(Date.now() - 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "token.expired",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const userId = UserIdentifierValueObject.generate();

    const token = "valid-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(userId, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "not_found",
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

    const token = "valid-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({});
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

    const token = "valid-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);

    const spy = vi.spyOn(emailVerificationPort, "markUsed");

    await useCase.execute({ token });

    expect(spy).toHaveBeenCalledWith(token);
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

    const token = "valid-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);

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

    const token = "valid-token";
    const expiresAt = new Date(Date.now() + 60_000);

    await emailVerificationPort.create(user.identifier, token, expiresAt);

    const result = await useCase.execute({ token });

    expect(result.success).toBe(true);
  });
});
