import { describe, expect, it, vi } from "vitest";

import { EmailVerificationEntity } from "#entities/email-verification.entity";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryIamUnitOfWork,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
} from "#testing/iam-test-doubles";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { VerifyEmailUseCase } from "./verify-email.use-case.js";

describe("VerifyEmailUseCase", () => {
  it("verifies the login identity addressed by the token", async () => {
    const users = new InMemoryUserRepository();
    const identities = new InMemoryLoginIdentityRepository();
    const authenticators = new InMemoryPasswordAuthenticatorRepository();
    const verifications = new InMemoryEmailVerificationRepository();
    const user = UserEntity.create();
    const login = LoginIdentifierValueObject.create(
      "email",
      "user@example.com",
    );
    const tokenHash = EmailVerificationTokenHashValueObject.create(
      "a".repeat(64),
    );
    if (!login.success || !tokenHash.success) {
      throw new Error("Invalid verification fixture");
    }
    const identity = LoginIdentityEntity.create({
      userId: user.identifier,
      login: login.value,
      verificationRequired: true,
    });
    const verification = EmailVerificationEntity.create({
      userId: user.identifier,
      loginIdentityId: identity.identifier,
      tokenHash: tokenHash.value,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await users.save(user);
    await identities.save(identity);
    await verifications.save(verification);

    const useCase = new VerifyEmailUseCase(
      identities,
      verifications,
      { hash: vi.fn().mockResolvedValue(tokenHash.value) } as never,
      new InMemoryIamUnitOfWork(
        users,
        identities,
        authenticators,
        verifications,
      ),
    );
    const result = await useCase.execute({
      token: crypto.randomUUID(),
    });

    expect(result.success).toBe(true);
    expect(identity.isVerified).toBe(true);
    expect(verification.isUsed).toBe(true);
  });

  it("returns a stable error for an invalid token", async () => {
    const identities = new InMemoryLoginIdentityRepository();
    const verifications = new InMemoryEmailVerificationRepository();
    const useCase = new VerifyEmailUseCase(
      identities,
      verifications,
      {} as never,
      {} as never,
    );
    const result = await useCase.execute({ token: "invalid" });
    expect(result.success).toBe(false);
  });
});
