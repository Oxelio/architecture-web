import { describe, expect, it } from "vitest";

import { UserEntity } from "#entities/user.entity";
import type { UserRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { AssignUserRoleUseCase } from "./assign-user-role.use-case.js";

class FakeUserRepository implements UserRepository {
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

describe("AssignUserRoleUseCase", () => {
  it("assigns the admin role to an existing user", async () => {
    const email = EmailValueObject.create("user@example.com");
    const password = PasswordHashValueObject.create("password-hash");
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }

    const users = new FakeUserRepository();
    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });
    await users.save(user);

    const result = await new AssignUserRoleUseCase(users).execute({
      userId: user.identifier.value,
      role: "admin",
    });

    expect(result.success).toBe(true);
    expect(user.role.value).toBe("admin");
  });

  it("rejects an unknown role", async () => {
    const result = await new AssignUserRoleUseCase(
      new FakeUserRepository(),
    ).execute({
      userId: UserIdentifierValueObject.generate().value,
      role: "owner",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user_role.invalid", value: "owner" },
    });
  });
});
