import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryIamUnitOfWork,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
  testPasswordHash,
} from "#testing/iam-test-doubles";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { ChangePasswordUseCase } from "./change-password.use-case.js";

describe("ChangePasswordUseCase", () => {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryLoginIdentityRepository();
  const authenticators = new InMemoryPasswordAuthenticatorRepository();
  const verifications = new InMemoryEmailVerificationRepository();
  const hasher = { verify: vi.fn(), hash: vi.fn() };
  const sessions = { deleteAllForUser: vi.fn() };
  const policy = { validate: vi.fn(), get: vi.fn() };

  beforeEach(() => {
    users.values.clear();
    identities.values.clear();
    authenticators.values.clear();
    hasher.verify.mockReset().mockResolvedValue(true);
    hasher.hash.mockReset().mockResolvedValue(testPasswordHash("new-hash"));
    sessions.deleteAllForUser.mockReset().mockResolvedValue(undefined);
    policy.validate.mockReset().mockResolvedValue({ errors: [] });
    policy.get.mockReset().mockResolvedValue({
      rejectCurrentPassword: false,
    });
  });

  async function account() {
    const user = UserEntity.create();
    const login = LoginIdentifierValueObject.create(
      "email",
      "user@example.com",
    );
    if (!login.success) {
      throw new Error("Invalid login fixture");
    }
    const identity = LoginIdentityEntity.create({
      userId: user.identifier,
      login: login.value,
      verificationRequired: false,
    });
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: user.identifier,
      passwordHash: testPasswordHash("old-hash"),
    });
    await users.save(user);
    await identities.save(identity);
    await authenticators.save(authenticator);
    return { user, authenticator };
  }

  function useCase() {
    return new ChangePasswordUseCase(
      users,
      identities,
      authenticators,
      hasher as never,
      sessions as never,
      policy as never,
      policy as never,
      new InMemoryIamUnitOfWork(
        users,
        identities,
        authenticators,
        verifications,
      ),
    );
  }

  it("changes the authenticator, invalidates sessions and clears Redis", async () => {
    const { user } = await account();
    const result = await useCase().execute({
      userId: user.identifier.value,
      currentPassword: "old-password",
      password: "new-password-value",
      passwordConfirmation: "new-password-value",
    });

    expect(result.success).toBe(true);
    expect(user.sessionVersion).toBe(2);
    expect(
      (await authenticators.findForUser(user.identifier))?.passwordHash.value,
    ).toBe("new-hash");
    expect(sessions.deleteAllForUser).toHaveBeenCalledWith(user.identifier);
    expect(policy.get).toHaveBeenCalledExactlyOnceWith("standard");
    expect(policy.validate).toHaveBeenCalledWith(
      expect.objectContaining({ rejectCurrentPassword: false }),
      expect.objectContaining({ password: "new-password-value" }),
    );
  });

  it("rejects an invalid current password", async () => {
    const { user } = await account();
    hasher.verify.mockResolvedValue(false);
    const result = await useCase().execute({
      userId: user.identifier.value,
      currentPassword: "wrong-password",
      password: "new-password-value",
      passwordConfirmation: "new-password-value",
    });
    expect(result.success).toBe(false);
    expect(user.sessionVersion).toBe(1);
  });
});
