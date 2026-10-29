import { describe, expect, it } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryLoginIdentityRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "#test/in-memory-repositories";

import { ListUsersUseCase } from "./list-users.use-case.js";

describe("ListUsersUseCase", () => {
  it("returns projected users to an administrator", async () => {
    const users = new InMemoryUserRepository();
    const identities = new InMemoryLoginIdentityRepository();
    const administrator = createAdministrator();
    await users.save(administrator);
    await users.save(UserEntity.create());
    const result = await new ListUsersUseCase(
      new AdministratorAuthorizer(users),
      new InMemoryUserQueryRepository(users, identities),
    ).execute({ actorUserId: administrator.identifier.value });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.users).toHaveLength(2);
      expect(result.value.users[0]?.email).toBeNull();
    }
  });
});
