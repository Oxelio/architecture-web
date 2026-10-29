import { describe, expect, it } from "vitest";

import { UserEntity } from "#entities/user.entity";
import type { UserRepository } from "#ports/user.repository";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import { AdministratorAuthorizer } from "./administrator-authorizer.js";

function createUser(): UserEntity {
  return UserEntity.create();
}

function repositoryFor(user: UserEntity | null): UserRepository {
  return {
    findById: async (id: UserIdentifierValueObject) =>
      user?.identifier.equals(id) ? user : null,
  } as UserRepository;
}

describe("AdministratorAuthorizer", () => {
  it("authorizes an active administrator loaded from the repository", async () => {
    const administrator = createUser();
    administrator.changeRole(UserRoleValueObject.admin());

    await expect(
      new AdministratorAuthorizer(repositoryFor(administrator)).authorize(
        administrator.identifier.value,
      ),
    ).resolves.toEqual({ success: true, value: undefined });
  });

  it.each(["regular", "suspended"] as const)(
    "rejects a %s actor",
    async (state) => {
      const actor = createUser();
      if (state === "suspended") {
        actor.changeRole(UserRoleValueObject.admin());
        actor.suspend();
      }

      await expect(
        new AdministratorAuthorizer(repositoryFor(actor)).authorize(
          actor.identifier.value,
        ),
      ).resolves.toEqual({
        success: false,
        error: { code: "administrator.unauthorized" },
      });
    },
  );
});
