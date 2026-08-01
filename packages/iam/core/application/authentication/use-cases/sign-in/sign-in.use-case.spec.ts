import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
  testPasswordHash,
  TestPolicyProvider,
} from "#testing/iam-test-doubles";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { SignInUseCase } from "./sign-in.use-case.js";

describe("SignInUseCase", () => {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryLoginIdentityRepository();
  const authenticators = new InMemoryPasswordAuthenticatorRepository();
  const sessions = { saveEnforcingMaximum: vi.fn() };
  const password = {
    verify: vi.fn(),
    fakeVerify: vi.fn(),
  };

  beforeEach(() => {
    users.values.clear();
    identities.values.clear();
    authenticators.values.clear();
    sessions.saveEnforcingMaximum.mockReset().mockResolvedValue(undefined);
    password.verify.mockReset().mockResolvedValue(true);
    password.fakeVerify.mockReset().mockResolvedValue(undefined);
  });

  async function account(
    kind: "username" | "email",
    value: string,
    verified = true,
  ) {
    const user = UserEntity.create();
    const login = LoginIdentifierValueObject.create(kind, value);
    if (!login.success) {
      throw new Error("Invalid login fixture");
    }
    const identity = LoginIdentityEntity.create({
      userId: user.identifier,
      login: login.value,
      verificationRequired: kind === "email",
    });
    if (verified) {
      identity.verify();
    }
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: user.identifier,
      passwordHash: testPasswordHash(),
    });
    await users.save(user);
    await identities.save(identity);
    await authenticators.save(authenticator);
    return { user, identity, authenticator };
  }

  function useCase(policy = new TestPolicyProvider()) {
    return new SignInUseCase(
      users,
      identities,
      authenticators,
      password as never,
      sessions as never,
      policy,
    );
  }

  it("signs in through a pseudonymous username", async () => {
    const { user } = await account("username", "dragon.blue");
    const result = await useCase().execute({
      login: { kind: "username", value: "DRAGON.BLUE" },
      password: "password",
    });

    expect(result.success).toBe(true);
    expect(sessions.saveEnforcingMaximum).toHaveBeenCalledOnce();
    if (result.success) {
      expect(result.value).toMatchObject({ userId: user.identifier.value });
    }
  });

  it("does not reveal whether a login exists", async () => {
    const result = await useCase().execute({
      login: { kind: "username", value: "missing-user" },
      password: "password",
    });
    expect(result).toEqual({
      success: false,
      error: { code: "user.invalid_credentials" },
    });
    expect(password.fakeVerify).toHaveBeenCalledOnce();
  });

  it("rejects a login kind disabled by the account identity policy", async () => {
    await account("email", "user@example.com");
    const result = await useCase(new TestPolicyProvider(["username"])).execute({
      login: { kind: "email", value: "user@example.com" },
      password: "password",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user.invalid_credentials" },
    });
    expect(password.fakeVerify).toHaveBeenCalledOnce();
    expect(password.verify).not.toHaveBeenCalled();
  });

  it("rejects an unverified email identity", async () => {
    await account("email", "user@example.com", false);
    const result = await useCase().execute({
      login: { kind: "email", value: "user@example.com" },
      password: "password",
    });
    expect(result.success).toBe(false);
    expect(password.verify).not.toHaveBeenCalled();
  });

  it("rejects an invalid password", async () => {
    await account("username", "dragon.blue");
    password.verify.mockResolvedValue(false);
    const result = await useCase().execute({
      login: { kind: "username", value: "dragon.blue" },
      password: "wrong-password",
    });
    expect(result.success).toBe(false);
    expect(sessions.saveEnforcingMaximum).not.toHaveBeenCalled();
  });
});
