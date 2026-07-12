import { describe, it, expect, beforeEach, vi } from "vitest";

import { ChangeEmailUseCase } from "./change-email.use-case.js";
import { EmailValueObject } from "../../domain/value-objects/email.value-object.js";
import { PasswordHashValueObject } from "../../domain/value-objects/password-hash.value-object.js";
import { UserEntity } from "../../domain/entities/user.entity.js";
import { UserIdentifierValueObject } from "../../domain/value-objects/user-identifier.value-object.js";
import type { UserPort } from "../ports/user.port.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserPort {
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
  let useCase: ChangeEmailUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    useCase = new ChangeEmailUseCase(userPort);
  });

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      userId: "",
      email: "new@test.com",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "not_found",
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
        code: "not_found",
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
