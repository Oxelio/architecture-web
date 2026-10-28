import { describe, expect, it, vi } from "vitest";

import { isMfaChallengeUsable, isMfaEnrollmentUsable } from "#domain/mfa";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryUserRepository,
  TestPolicies,
} from "#testing/iam-test-doubles";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import {
  BeginSecondFactorUseCase,
  ConfirmMfaEnrollmentUseCase,
  DisableMfaUseCase,
} from "./mfa.use-cases.js";
describe("MFA application boundaries", () => {
  it("requires enrollment for the authoritative privileged role", async () => {
    const users = new InMemoryUserRepository(),
      user = UserEntity.create();
    user.changeRole(UserRoleValueObject.admin());
    await users.save(user);
    const store = {
        credential: vi.fn(async () => null),
        beginChallenge: vi.fn(),
      },
      policies = new TestPolicies();
    policies.getAuthenticationPolicy = async () => ({
      mfaAvailable: true,
      mfaRequiredRoles: ["admin"],
      mfaChallengeMinutes: 5,
      mfaMaxAttempts: 5,
      recentAuthenticationMinutes: 15,
    });
    const result = await new BeginSecondFactorUseCase(
      users,
      policies,
      store as never,
      {} as never,
    ).execute({ userId: user.identifier.value });
    expect(result).toEqual({
      success: false,
      error: { code: "MFA_ENROLLMENT_REQUIRED" },
    });
    expect(store.beginChallenge).not.toHaveBeenCalled();
  });
  it("stores only normalized backup derivatives and rejects an enrollment lost to a race", async () => {
    const now = new Date(),
      store = {
        credential: async () => ({
          userId: "actor",
          sealedSecret: "sealed",
          enabledAt: null,
          enrollmentExpiresAt: new Date(now.getTime() + 60000),
          lastCounter: null,
        }),
        confirmEnrollment: vi.fn(async () => false),
      };
    const crypto = {
      open: () => "secret",
      verifyTotp: () => 3,
      generateBackupCodes: () => ["ABCD-EFGH"],
    };
    const result = await new ConfirmMfaEnrollmentUseCase(
      store as never,
      crypto as never,
      {
        identifier: () => "confirmation",
        hash: (value) => `hash:${value}`,
        generate: () => "token",
      },
    ).execute({ userId: "actor", code: "123456" });
    expect(result).toEqual({
      success: false,
      error: { code: "MFA_ENROLLMENT_INVALID" },
    });
    expect(store.confirmEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({ backupHashes: ["hash:ABCDEFGH"] }),
    );
  });
  it("does not consume a factor when policy forbids deactivation", async () => {
    const users = new InMemoryUserRepository(),
      user = UserEntity.create();
    user.changeRole(UserRoleValueObject.admin());
    await users.save(user);
    const factor = { verify: vi.fn() },
      policies = new TestPolicies();
    policies.getAuthenticationPolicy = async () => ({
      mfaAvailable: true,
      mfaRequiredRoles: ["admin"],
      mfaChallengeMinutes: 5,
      mfaMaxAttempts: 5,
      recentAuthenticationMinutes: 15,
    });
    const result = await new DisableMfaUseCase(
      { recent: async () => ({ success: true, value: undefined }) } as never,
      factor as never,
      policies,
      users,
      {} as never,
      {} as never,
    ).execute({
      userId: user.identifier.value,
      sessionId: "session",
      password: "password",
      code: "123456",
    });
    expect(result).toEqual({
      success: false,
      error: { code: "MFA_REQUIRED_BY_POLICY" },
    });
    expect(factor.verify).not.toHaveBeenCalled();
  });
  it("makes expiry, consumption and exhausted attempts unusable", () => {
    const challenge = {
      id: "id",
      userId: "user",
      purpose: "signin" as const,
      attempts: 3,
      maximumAttempts: 3,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };
    expect(isMfaChallengeUsable(challenge, new Date())).toBe(false);
    expect(
      isMfaChallengeUsable(
        { ...challenge, attempts: 0, consumedAt: new Date() },
        new Date(),
      ),
    ).toBe(false);
    expect(
      isMfaEnrollmentUsable(
        {
          userId: "user",
          sealedSecret: "sealed",
          enrollmentExpiresAt: new Date(0),
          enabledAt: null,
          lastCounter: null,
        },
        new Date(),
      ),
    ).toBe(false);
  });
});
