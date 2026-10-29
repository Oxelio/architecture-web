import { describe, expect, it } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { UserEntity } from "#entities/user.entity";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { AssignUserRoleUseCase } from "./assign-user-role.use-case.js";

class FakeUserRepository implements UserRepository {
  async hasOtherAdministrativeAccess() {
    return true;
  }
  private readonly users = new Map<string, UserEntity>();

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }
}

describe("AssignUserRoleUseCase", () => {
  it("assigns the admin role to an existing user", async () => {
    const users = new FakeUserRepository();
    const administrator = createAdministrator();
    await users.save(administrator);
    const user = UserEntity.create();
    await users.save(user);

    const result = await new AssignUserRoleUseCase(
      new AdministratorAuthorizer(users),
      {
        executeForUser: async (
          _id: UserIdentifierValueObject,
          work: Parameters<IamUnitOfWork["execute"]>[0],
        ) => work({ users: users, userQueries: users } as never),
      } as IamUnitOfWork,
    ).execute({
      actorUserId: administrator.identifier.value,
      userId: user.identifier.value,
      role: "admin",
    });

    expect(result.success).toBe(true);
    expect(user.role.value).toBe("admin");
  });

  it("rejects an unknown role", async () => {
    const users = new FakeUserRepository();
    const administrator = createAdministrator();
    await users.save(administrator);
    const result = await new AssignUserRoleUseCase(
      new AdministratorAuthorizer(users),
      {
        executeForUser: async (
          _id: UserIdentifierValueObject,
          work: Parameters<IamUnitOfWork["execute"]>[0],
        ) => work({ users: users, userQueries: users } as never),
      } as IamUnitOfWork,
    ).execute({
      actorUserId: administrator.identifier.value,
      userId: UserIdentifierValueObject.generate().value,
      role: "owner",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user_role.invalid", value: "owner" },
    });
  });

  it("prevents an administrator from changing their own role", async () => {
    const users = new FakeUserRepository();
    const administrator = createAdministrator();
    await users.save(administrator);
    const result = await new AssignUserRoleUseCase(
      new AdministratorAuthorizer(users),
      {
        executeForUser: async (
          _id: UserIdentifierValueObject,
          work: Parameters<IamUnitOfWork["execute"]>[0],
        ) => work({ users: users, userQueries: users } as never),
      } as IamUnitOfWork,
    ).execute({
      userId: administrator.identifier.value,
      actorUserId: administrator.identifier.value,
      role: "user",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user.self_administration_forbidden" },
    });
  });
});
