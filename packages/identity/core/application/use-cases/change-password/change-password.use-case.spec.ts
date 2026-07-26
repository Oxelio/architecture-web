// @file bounded-contexts/identity/application/use-cases/change-password/change-password.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserEntity } from "#entities/user.entity";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import type { PasswordHasher } from "#services/password-hasher.service";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ChangePasswordUseCase } from "./change-password.use-case.js";

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

/* ---------------- FAKE PASSWORD HASHER ---------------- */

class FakePasswordHasherPort implements PasswordHasher {
  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const result = PasswordHashValueObject.create("hashed-" + password.value);

    if (!result.success) {
      throw new Error("Invalid hash");
    }

    return result.value;
  }

  async verify(): Promise<boolean> {
    return true;
  }

  async fakeVerify(): Promise<void> {
    // timing attack protection noop
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("ChangePasswordUseCase", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let sessionPort: SessionRepository;
  let useCase: ChangePasswordUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    sessionPort = { deleteAllForUser: vi.fn() } as unknown as SessionRepository;
    useCase = new ChangePasswordUseCase(userPort, passwordHasher, sessionPort);
  });

  /* -------------------------------------------------- */
  /* 1. INVALID USER ID FORMAT                          */
  /* -------------------------------------------------- */

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      userId: "",
      password: "newPassword123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 2. INVALID PASSWORD FORMAT                         */
  /* -------------------------------------------------- */

  it("should fail when password is invalid", async () => {
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

    const result = await useCase.execute({
      userId: user.identifier.value,
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("password.empty");
    }
  });

  /* -------------------------------------------------- */
  /* 3. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const validId = UserIdentifierValueObject.generate().value;

    const result = await useCase.execute({
      userId: validId,
      password: "newPassword123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. SUCCESS CASE                                    */
  /* -------------------------------------------------- */

  it("should change password successfully", async () => {
    const email = EmailValueObject.create("test@test.com");
    const oldPassword = PasswordHashValueObject.create("old-hashed-password");

    if (!email.success || !oldPassword.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: oldPassword.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      userId: user.identifier.value,
      password: "newPassword123",
    });

    expect(result.success).toBe(true);

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.password.value).toBe("hashed-newPassword123");
    expect(sessionPort.deleteAllForUser).toHaveBeenCalledWith(user.identifier);
  });

  /* -------------------------------------------------- */
  /* 5. HASHER CALLED                                   */
  /* -------------------------------------------------- */

  it("should call password hasher", async () => {
    const email = EmailValueObject.create("test@test.com");
    const oldPassword = PasswordHashValueObject.create("old-hashed-password");

    if (!email.success || !oldPassword.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: oldPassword.value,
    });

    await userPort.save(user);

    const spy = vi.spyOn(passwordHasher, "hash");

    await useCase.execute({
      userId: user.identifier.value,
      password: "newPassword123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 6. SAVE CALLED                                     */
  /* -------------------------------------------------- */

  it("should call save on user port", async () => {
    const email = EmailValueObject.create("test@test.com");
    const oldPassword = PasswordHashValueObject.create("old-hashed-password");

    if (!email.success || !oldPassword.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: oldPassword.value,
    });

    await userPort.save(user);

    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      userId: user.identifier.value,
      password: "newPassword123",
    });

    expect(spy).toHaveBeenCalled();
  });

  /* -------------------------------------------------- */
  /* 7. PASSWORD TOO SHORT                              */
  /* -------------------------------------------------- */

  it("should fail when password is too short", async () => {
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

    const result = await useCase.execute({
      userId: user.identifier.value,
      password: "1234567",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("password.too_short");
    }
  });
});
