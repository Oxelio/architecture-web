import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryIamUnitOfWork,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
  testPasswordHash,
  TestPolicyProvider,
} from "#testing/iam-test-doubles";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SignUpUseCase } from "./sign-up.use-case.js";

describe("SignUpUseCase", () => {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryLoginIdentityRepository();
  const authenticators = new InMemoryPasswordAuthenticatorRepository();
  const verifications = new InMemoryEmailVerificationRepository();
  const sender = { sendVerificationEmail: vi.fn() };
  const tokenHash = EmailVerificationTokenHashValueObject.create(
    "a".repeat(64),
  );
  if (!tokenHash.success) {
    throw new Error("Invalid token hash fixture");
  }
  const validTokenHash = tokenHash.value;

  beforeEach(() => {
    users.values.clear();
    identities.values.clear();
    authenticators.values.clear();
    verifications.values.clear();
    sender.sendVerificationEmail.mockReset();
  });

  function useCase(policy = new TestPolicyProvider()) {
    return new SignUpUseCase(
      identities,
      { hash: vi.fn().mockResolvedValue(testPasswordHash()) } as never,
      sender as never,
      { hash: vi.fn().mockResolvedValue(validTokenHash) } as never,
      { validate: vi.fn().mockResolvedValue({ errors: [] }) } as never,
      new InMemoryIamUnitOfWork(
        users,
        identities,
        authenticators,
        verifications,
      ),
      policy,
    );
  }

  it("registers a pseudonymous username without collecting an email", async () => {
    const result = await useCase().execute({
      login: { kind: "username", value: "Dragon.Blue" },
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
    });

    expect(result.success).toBe(true);
    expect(users.values).toHaveLength(1);
    expect([...identities.values.values()][0]?.login.value).toBe("dragon.blue");
    expect(authenticators.values).toHaveLength(1);
    expect(verifications.values).toHaveLength(0);
    expect(sender.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("creates an email verification only when the policy requires it", async () => {
    const result = await useCase().execute({
      login: { kind: "email", value: "USER@example.com" },
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
    });

    expect(result.success).toBe(true);
    expect([...identities.values.values()][0]?.verificationStatus).toBe(
      "pending",
    );
    expect(verifications.values).toHaveLength(1);
    expect(sender.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("rejects an identifier kind disabled by policy", async () => {
    const result = await useCase(new TestPolicyProvider(["username"])).execute({
      login: { kind: "email", value: "user@example.com" },
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "login_identifier.not_allowed" },
    });
  });

  it("rejects an already owned login", async () => {
    const login = LoginIdentifierValueObject.create("username", "dragon.blue");
    if (!login.success) {
      throw new Error("Invalid login fixture");
    }
    await identities.save(
      LoginIdentityEntity.create({
        userId: UserIdentifierValueObject.generate(),
        login: login.value,
        verificationRequired: false,
      }),
    );

    const result = await useCase().execute({
      login: { kind: "username", value: "dragon.blue" },
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
    });
    expect(result.success).toBe(false);
  });
});
