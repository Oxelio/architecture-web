// @file bounded-contexts/iam/application/use-cases/get-current-account/get-current-account.use-case.spec.ts

import { beforeEach, describe, expect, it } from "vitest";

import type { UserEntity } from "#entities/user.entity";
import type { UserRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import { GetCurrentAccountUseCase } from "./get-current-account.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
  private readonly users = new Map<string, UserEntity>();

  async findByEmail(_email: EmailValueObject): Promise<UserEntity | null> {
    throw new Error("Method not implemented.");
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("GetCurrentAccountUseCase", () => {
  let userPort: FakeUserPort;
  let useCase: GetCurrentAccountUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    useCase = new GetCurrentAccountUseCase(userPort);
  });

  /* -------------------------------------------------- */
  /* 1. INVALID USER ID FORMAT                          */
  /* -------------------------------------------------- */

  it("should return not_found when userId is invalid", async () => {
    const result = await useCase.execute({
      actorUserId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 2. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should return not_found when user does not exist", async () => {
    const validId = UserIdentifierValueObject.generate().value;

    const result = await useCase.execute({
      actorUserId: validId,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 3. SUCCESS CASE                                    */
  /* -------------------------------------------------- */

  it("should return the current account when the user exists", async () => {
    const userId = UserIdentifierValueObject.generate();
    const email = EmailValueObject.create("test@test.com");

    if (!email.success) {
      throw new Error("Invalid email");
    }

    const user = {
      identifier: userId,
      email: email.value,
      role: UserRoleValueObject.admin(),
      isEmailVerified: true,
      createdAt: new Date("2025-01-10T08:30:00.000Z"),
      updatedAt: new Date("2025-02-12T14:45:00.000Z"),
    } as UserEntity;

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId: userId.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        userId: userId.value,
        email: "test@test.com",
        isEmailVerified: true,
        role: "admin",
        createdAt: "2025-01-10T08:30:00.000Z",
        updatedAt: "2025-02-12T14:45:00.000Z",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. VALUE OBJECT VALIDATION FLOW                   */
  /* -------------------------------------------------- */

  it("should call value object validation and fail early", async () => {
    const result = await useCase.execute({
      actorUserId: "invalid-id",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("user.invalid_id");
    }
  });
});
