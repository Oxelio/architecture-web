import { describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { UserEntity } from "#entities/user.entity";
import type {
  UserRepository,
  UserSearchCriteria,
} from "#repositories/user.repository";
import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { ListUsersUseCase } from "./list-users.use-case.js";

class FakeUsers implements UserRepository {
  readonly search = vi.fn(
    async (_criteria: UserSearchCriteria) =>
      ({ users: this.users, total: this.users.length }) as const,
  );

  constructor(private readonly users: UserEntity[]) {}
  async getAdministrationOverview() {
    return { total: 0, active: 0, suspended: 0, administrators: 0 };
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
  it("normalizes criteria, applies defaults and returns a safe paginated result", async () => {
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
    const users = new FakeUsers([administrator, user]);

    const result = await new ListUsersUseCase(users).execute({
      actorUserId: administrator.identifier.value,
      search: "  ADMIN@example.com ",
      role: "user",
      status: "active",
      isEmailVerified: true,
    });

    expect(users.search).toHaveBeenCalledWith({
      search: "ADMIN@example.com",
      role: "user",
      status: "active",
      isEmailVerified: true,
      page: 1,
      pageSize: 25,
    });
    expect(result).toMatchObject({
      success: true,
      value: {
        users: [
          {
            userId: administrator.identifier.value,
            email: "administrator@example.com",
          },
          {
            userId: user.identifier.value,
            email: "admin@example.com",
            isEmailVerified: true,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 2,
          totalPages: 1,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("hashed-password");
  });

  it.each([
    [{ page: 0 }, "users.invalid_page"],
    [{ page: -1 }, "users.invalid_page"],
    [{ page: 1.5 }, "users.invalid_page"],
    [{ pageSize: 0 }, "users.invalid_page_size"],
    [{ pageSize: 101 }, "users.invalid_page_size"],
    [{ pageSize: 1.5 }, "users.invalid_page_size"],
  ])("rejects invalid pagination %o", async (pagination, code) => {
    const administrator = createAdministrator();
    const result = await new ListUsersUseCase(
      new FakeUsers([administrator]),
    ).execute({
      actorUserId: administrator.identifier.value,
      ...pagination,
    });

    expect(result).toEqual({ success: false, error: { code } });
  });

  it("authorizes before executing the administrative query", async () => {
    const users = new FakeUsers([]);

    const result = await new ListUsersUseCase(users).execute({
      actorUserId: "not-an-identifier",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "administrator.unauthorized" },
    });
    expect(users.search).not.toHaveBeenCalled();
  });
});
