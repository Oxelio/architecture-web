// @file bounded-contexts/iam/application/use-cases/change-email/change-email.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserEntity } from "#entities/user.entity";
import type { EmailVerificationRepository } from "#repositories/email-verification.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { EmailSender } from "#services/email-sender.service";
import type { EmailVerificationTokenHasher } from "#services/email-verification-token-hasher.service";
import { EmailValueObject } from "#value-objects/email.value-object";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ChangeEmailUseCase } from "./change-email.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
  async search(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
  async getAdministrationOverview(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
  private readonly users = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    for (const user of this.users.values()) {
      if (user.email.value === email.value) {
        return user;
      }
    }

    return null;
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("ChangeEmailUseCase", () => {
  let userPort: FakeUserPort;
  let emailVerification: EmailVerificationRepository;
  let emailSender: EmailSender;
  let tokenHasher: EmailVerificationTokenHasher;
  let useCase: ChangeEmailUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    emailVerification = {
      invalidatePreviousFor: vi.fn(),
      save: vi.fn(),
    } as unknown as EmailVerificationRepository;
    emailSender = { sendVerificationEmail: vi.fn() } as EmailSender;
    tokenHasher = {
      hash: vi.fn(async () => {
        const hash = EmailVerificationTokenHashValueObject.create(
          "a".repeat(64),
        );
        if (!hash.success) {
          throw new Error("Invalid hash");
        }
        return hash.value;
      }),
    } as EmailVerificationTokenHasher;
    useCase = new ChangeEmailUseCase(
      userPort,
      emailVerification,
      emailSender,
      tokenHasher,
    );
  });

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      userId: "",
      email: "new@test.com",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  it("should fail when email is invalid", async () => {
    const email = EmailValueObject.create("old@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid data");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      userId: user.identifier.value,
      email: "invalid-email",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("email.invalid_format");
    }
  });

  it("should fail when user does not exist", async () => {
    const userId = UserIdentifierValueObject.generate();

    const result = await useCase.execute({
      userId: userId.value,
      email: "new@test.com",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  it("should fail when email already exists for another user", async () => {
    const email1 = EmailValueObject.create("user1@test.com");
    const email2 = EmailValueObject.create("user2@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email1.success || !email2.success || !password.success) {
      throw new Error("Invalid data");
    }

    const user1 = UserEntity.create({
      email: email1.value,
      password: password.value,
    });

    const user2 = UserEntity.create({
      email: email2.value,
      password: password.value,
    });

    await userPort.save(user1);
    await userPort.save(user2);

    const result = await useCase.execute({
      userId: user1.identifier.value,
      email: "user2@test.com",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.already_exists",
      });
    }
  });

  it("should change email successfully", async () => {
    const oldEmail = EmailValueObject.create("old@test.com");

    const password = PasswordHashValueObject.create("hashed-password");

    if (!oldEmail.success || !password.success) {
      throw new Error("Invalid data");
    }

    const user = UserEntity.create({
      email: oldEmail.value,
      password: password.value,
    });
    user.verifyEmail();

    await userPort.save(user);

    const result = await useCase.execute({
      userId: user.identifier.value,
      email: "new@test.com",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.email.value).toBe("new@test.com");
    expect(updatedUser?.isEmailVerified).toBe(false);
    expect(emailVerification.invalidatePreviousFor).toHaveBeenCalledWith(
      user.identifier,
    );
    expect(emailSender.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("should succeed when changing to same email", async () => {
    const email = EmailValueObject.create("same@test.com");

    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid data");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      userId: user.identifier.value,
      email: "same@test.com",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }
  });

  it("should call save on user port", async () => {
    const email = EmailValueObject.create("old@test.com");

    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid data");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    await userPort.save(user);

    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      userId: user.identifier.value,
      email: "new@test.com",
    });

    expect(spy).toHaveBeenCalledOnce();
  });
});
