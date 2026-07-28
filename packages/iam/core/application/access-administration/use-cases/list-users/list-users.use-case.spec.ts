import { describe, expect, it } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { UserEntity } from "#entities/user.entity";
import type { UserAdministrationRepository } from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListUsersUseCase } from "./list-users.use-case.js";

class FakeUsers implements UserAdministrationRepository {
  constructor(private readonly users: UserEntity[]) {}
  async findAll() {
    return this.users;
  }
  async findById(id: UserIdentifierValueObject) {
    return this.users.find((user) => user.identifier.equals(id)) ?? null;
  }
  async findByEmail() {
    return null;
  }
  async save() {
    return undefined;
  }
}

describe("ListUsersUseCase", () => {
  it("returns administration-safe user summaries", async () => {
    const email = EmailValueObject.create("admin@example.com");
    const password = PasswordHashValueObject.create("hashed-password");
    if (!email.success || !password.success) {
      throw new Error("Invalid fixture");
    }
    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });
    user.verifyEmail();
    const administrator = createAdministrator();

    const result = await new ListUsersUseCase(
      new FakeUsers([administrator, user]),
    ).execute({ actorUserId: administrator.identifier.value });

    expect(result).toMatchObject({
      success: true,
      value: [
        {
          userId: administrator.identifier.value,
          email: "administrator@example.com",
          role: "admin",
          status: "active",
          isEmailVerified: false,
        },
        {
          userId: user.identifier.value,
          email: "admin@example.com",
          role: "user",
          status: "active",
          isEmailVerified: true,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("hashed-password");
  });
});
