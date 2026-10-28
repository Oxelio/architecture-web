import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
} from "#test/in-memory-repositories";
import { InMemoryIamUnitOfWork } from "#test/in-memory-unit-of-work";
import { TestPolicies } from "#test/test-policies";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { ChangeEmailUseCase } from "./change-email.use-case.js";

describe("ChangeEmailUseCase", () => {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryLoginIdentityRepository();
  const authenticators = new InMemoryPasswordAuthenticatorRepository();
  const verifications = new InMemoryEmailVerificationRepository();
  const sender = { sendVerificationEmail: vi.fn() };
  const hash = EmailVerificationTokenHashValueObject.create("a".repeat(64));
  if (!hash.success) {
    throw new Error("Invalid token hash fixture");
  }
  const validHash = hash.value;

  beforeEach(() => {
    users.values.clear();
    identities.values.clear();
    verifications.values.clear();
    sender.sendVerificationEmail.mockReset().mockResolvedValue(undefined);
  });

  function useCase(policy = new TestPolicies()) {
    return new ChangeEmailUseCase(
      users,
      identities,
      sender as never,
      { hash: vi.fn().mockResolvedValue(validHash) } as never,
      new InMemoryIamUnitOfWork(
        users,
        identities,
        authenticators,
        verifications,
      ),
      policy,
    );
  }

  it("adds an optional email identity to a pseudonymous account", async () => {
    const user = UserEntity.create();
    await users.save(user);
    const result = await useCase().execute({
      userId: user.identifier.value,
      email: "USER@example.com",
    });

    expect(result.success).toBe(true);
    const identity = await identities.findForUser(user.identifier, "email");
    expect(identity?.login.value).toBe("user@example.com");
    expect(identity?.verificationStatus).toBe("pending");
    expect(sender.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("rejects an email already owned by another account", async () => {
    const owner = UserEntity.create();
    const user = UserEntity.create();
    const login = LoginIdentifierValueObject.create(
      "email",
      "used@example.com",
    );
    if (!login.success) {
      throw new Error("Invalid login fixture");
    }
    await users.save(owner);
    await users.save(user);
    await identities.save(
      LoginIdentityEntity.create({
        userId: owner.identifier,
        login: login.value,
        verificationRequired: false,
      }),
    );

    const result = await useCase().execute({
      userId: user.identifier.value,
      email: "used@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("makes email immediately usable when verification is disabled", async () => {
    const user = UserEntity.create();
    await users.save(user);
    await useCase(new TestPolicies(["email"], false)).execute({
      userId: user.identifier.value,
      email: "user@example.com",
    });
    const identity = await identities.findForUser(user.identifier, "email");
    expect(identity?.verificationStatus).toBe("not_required");
    expect(verifications.values).toHaveLength(0);
    expect(sender.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
