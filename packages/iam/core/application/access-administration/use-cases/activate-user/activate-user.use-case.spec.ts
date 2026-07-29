// @file bounded-contexts/iam/application/use-cases/activate-user/activate-user.use-case.spec.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { UserEntity } from "#entities/user.entity";
import type { UserRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ActivateUserUseCase } from "./activate-user.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
  async search(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
  async getAdministrationOverview(): Promise<never> {
    throw new Error("Not used by this fixture");
  }
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

/* ---------------- TEST SUITE ---------------- */

describe("ActivateUserUseCase", () => {
  let userPort: FakeUserPort;
  let useCase: ActivateUserUseCase;
  let actorUserId: string;

  beforeEach(async () => {
    userPort = new FakeUserPort();
    const administrator = createAdministrator();
    await userPort.save(administrator);
    actorUserId = administrator.identifier.value;
    useCase = new ActivateUserUseCase(userPort);
  });

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      actorUserId,
      userId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  it("should fail when userId is not a valid UUID", async () => {
    const result = await useCase.execute({
      actorUserId,
      userId: "invalid-uuid",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  it("should fail when user does not exist", async () => {
    const validId = UserIdentifierValueObject.generate();

    const result = await useCase.execute({
      actorUserId,
      userId: validId.value,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  it("should activate user when user exists", async () => {
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
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser?.status.isActive()).toBe(true);
  });

  it("should not fail when user is already active", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.activate();

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);
  });

  it("should activate suspended user", async () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed-password");

    if (!email.success || !password.success) {
      throw new Error("Invalid email or password");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.suspend();

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.status.isActive()).toBe(true);
  });

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

    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(spy).toHaveBeenCalledOnce();
  });
});
