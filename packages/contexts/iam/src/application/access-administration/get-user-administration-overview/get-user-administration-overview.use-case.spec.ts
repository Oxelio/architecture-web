import { describe, expect, it } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import {
  InMemoryLoginIdentityRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "#test/in-memory-repositories";

import { GetUserAdministrationOverviewUseCase } from "./get-user-administration-overview.use-case.js";

describe("GetUserAdministrationOverviewUseCase", () => {
  it("returns aggregate counters to an administrator", async () => {
    const users = new InMemoryUserRepository();
    const administrator = createAdministrator();
    await users.save(administrator);
    const useCase = new GetUserAdministrationOverviewUseCase(
      new AdministratorAuthorizer(users),
      new InMemoryUserQueryRepository(
        users,
        new InMemoryLoginIdentityRepository(),
      ),
    );
    const result = await useCase.execute({
      actorUserId: administrator.identifier.value,
    });
    expect(result).toMatchObject({
      success: true,
      value: { total: 1, administrators: 1 },
    });
  });
});
