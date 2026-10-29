import { describe, expect, it, vi } from "vitest";

import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
} from "#test/in-memory-repositories";
import { InMemoryIamUnitOfWork } from "#test/in-memory-unit-of-work";
import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import { ResendEmailVerificationUseCase } from "./resend-email-verification.use-case.js";

describe("ResendEmailVerificationUseCase", () => {
  it("resends verification for the email identity", async () => {
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
      throw new Error("Invalid fixture");
    }
    await users.save(user);
    await identities.save(
      LoginIdentityEntity.create({
        userId: user.identifier,
        login: login.value,
        verificationRequired: true,
      }),
    );
    const sender = { sendVerificationEmail: vi.fn() };
    const useCase = new ResendEmailVerificationUseCase(
      users,
      identities,
      sender as never,
      {
        isAllowed: vi.fn().mockResolvedValue(true),
        recordSuccess: vi.fn(),
      } as never,
      { hash: vi.fn().mockResolvedValue(tokenHash.value) } as never,
      new InMemoryIamUnitOfWork(
        users,
        identities,
        authenticators,
        verifications,
      ),
    );

    const result = await useCase.execute({ userId: user.identifier.value });
    expect(result.success).toBe(true);
    expect(sender.sendVerificationEmail).toHaveBeenCalledOnce();
    expect(verifications.values.size).toBe(1);
  });
});
