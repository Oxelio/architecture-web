import { describe, expect, it } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryLoginIdentityRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "#testing/iam-test-doubles";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { GetCurrentAccountUseCase } from "./get-current-account.use-case.js";

describe("GetCurrentAccountUseCase", () => {
  it("returns a pseudonymous account without inventing an email", async () => {
    const users = new InMemoryUserRepository();
    const identities = new InMemoryLoginIdentityRepository();
    const user = UserEntity.create();
    const login = LoginIdentifierValueObject.create("username", "dragon.blue");
    if (!login.success) {
      throw new Error("Invalid login fixture");
    }
    await users.save(user);
    await identities.save(
      LoginIdentityEntity.create({
        userId: user.identifier,
        login: login.value,
        verificationRequired: false,
      }),
    );
    const result = await new GetCurrentAccountUseCase(
      new InMemoryUserQueryRepository(users, identities),
    ).execute({ actorUserId: user.identifier.value });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.email).toBeNull();
      expect(result.value.loginIdentifiers).toEqual([
        {
          kind: "username",
          value: "dragon.blue",
          verificationStatus: "not_required",
        },
      ]);
    }
  });

  it("returns not found for an unknown account", async () => {
    const result = await new GetCurrentAccountUseCase(
      new InMemoryUserQueryRepository(
        new InMemoryUserRepository(),
        new InMemoryLoginIdentityRepository(),
      ),
    ).execute({ actorUserId: UserEntity.create().identifier.value });
    expect(result.success).toBe(false);
  });
});
