import { describe, expect, it, vi } from "vitest";

import { PasswordValidation } from "#accounts/password-policy/password-validation";
import { createPasswordPolicy } from "#domain/password-policy";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserRepository,
  testPasswordHash,
} from "#testing/iam-test-doubles";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import type { PasswordRecoveryStore } from "./password-recovery.store.js";
import { ResetRecoveredPasswordUseCase } from "./password-recovery.use-cases.js";
async function fixture(admin = false) {
  const users = new InMemoryUserRepository(),
    passwords = new InMemoryPasswordAuthenticatorRepository(),
    identities = new InMemoryLoginIdentityRepository(),
    user = UserEntity.create();
  if (admin) {
    user.changeRole(UserRoleValueObject.admin());
  }
  const authenticator = PasswordAuthenticatorEntity.create({
    userId: user.identifier,
    passwordHash: testPasswordHash("old"),
  });
  await users.save(user);
  await passwords.save(authenticator);
  const login = LoginIdentifierValueObject.create(
    "email",
    "owner@example.test",
  );
  if (!login.success) {
    throw new Error("fixture");
  }
  const identity = LoginIdentityEntity.create({
    userId: user.identifier,
    login: login.value,
    verificationRequired: true,
  });
  identity.verify();
  await identities.save(identity);
  const token = {
    id: "recovery",
    userId: user.identifier.value,
    expiresAt: new Date(Date.now() + 60000),
    consumedAt: null as Date | null,
    invalidatedAt: null as Date | null,
  };
  const consume = vi.fn(async () => {
    token.consumedAt = new Date();
  });
  const store = {
    find: vi.fn(async () => token),
    issue: vi.fn(),
    withUsableToken: async <T>(
      _hash: string,
      _now: Date,
      work: (
        commit: import("./password-recovery.store.js").RecoveryCommit,
      ) => Promise<T>,
    ) =>
      work({
        user,
        authenticator,
        users,
        passwordAuthenticators: passwords,
        consume,
      }),
  } satisfies PasswordRecoveryStore;
  const policies = {
    get: vi.fn(async () =>
      createPasswordPolicy(admin ? "critical" : "elevated", {
        rejectCurrentPassword: false,
        checkUserContext: false,
      }),
    ),
  };
  const common = { isCommon: vi.fn(async () => false) },
    compromised = { isCompromised: vi.fn(async () => false) },
    strength = { evaluate: vi.fn(async () => "very_strong" as const) };
  const hasher = {
    hash: vi.fn(async () => testPasswordHash("replacement")),
    verify: vi.fn(async () => false),
    fakeVerify: vi.fn(),
  };
  const sessions = { deleteAllForUser: vi.fn(async () => undefined) };
  const useCase = new ResetRecoveredPasswordUseCase(
    store,
    users,
    passwords,
    identities,
    policies,
    new PasswordValidation(strength, common, compromised),
    hasher,
    { hash: (value) => value, generate: () => "token", identifier: () => "id" },
    sessions as never,
  );
  const input = {
    token: "usable-token",
    password: "a long and sufficiently strong replacement phrase",
    passwordConfirmation: "a long and sufficiently strong replacement phrase",
    context: { actorType: "anonymous" as const },
  };
  return {
    user,
    authenticator,
    store,
    token,
    consume,
    policies,
    common,
    compromised,
    hasher,
    sessions,
    useCase,
    input,
  };
}
describe("recovered password replacement", () => {
  it("uses one privileged policy, consumes the token and invalidates all sessions", async () => {
    const f = await fixture(true);
    f.user.suspend();
    expect((await f.useCase.execute(f.input)).success).toBe(true);
    expect(f.policies.get).toHaveBeenCalledExactlyOnceWith("privileged");
    expect(f.consume).toHaveBeenCalledOnce();
    expect(f.user.sessionVersion).toBe(2);
    expect(f.user.status.isSuspended()).toBe(true);
    expect(f.authenticator.passwordHash.value).toBe("replacement");
    expect(f.sessions.deleteAllForUser).toHaveBeenCalledWith(f.user.identifier);
  });
  it("rejects compromised passwords without consuming the token or hashing", async () => {
    const f = await fixture();
    f.compromised.isCompromised.mockResolvedValue(true);
    expect(await f.useCase.execute(f.input)).toEqual({
      success: false,
      error: { code: "password.compromised" },
    });
    expect(f.consume).not.toHaveBeenCalled();
    expect(f.hasher.hash).not.toHaveBeenCalled();
  });
  it("uses the same public outcome for expired and consumed tokens", async () => {
    const f = await fixture();
    f.token.expiresAt = new Date(0);
    const expired = await f.useCase.execute(f.input);
    f.token.expiresAt = new Date(Date.now() + 60000);
    f.token.consumedAt = new Date();
    expect(await f.useCase.execute(f.input)).toEqual(expired);
    expect(expired).toEqual({
      success: false,
      error: { code: "RECOVERY_TOKEN_INVALID" },
    });
  });
  it("propagates checker failure without changing account state", async () => {
    const f = await fixture(),
      failure = new Error("checker offline");
    f.compromised.isCompromised.mockRejectedValue(failure);
    await expect(f.useCase.execute(f.input)).rejects.toBe(failure);
    expect(f.consume).not.toHaveBeenCalled();
    expect(f.user.sessionVersion).toBe(1);
  });
  it("retains the committed session version when Redis cleanup fails", async () => {
    const f = await fixture(),
      failure = new Error("Redis unavailable");
    f.sessions.deleteAllForUser.mockRejectedValue(failure);
    await expect(f.useCase.execute(f.input)).rejects.toBe(failure);
    expect(f.consume).toHaveBeenCalledOnce();
    expect(f.user.sessionVersion).toBe(2);
    expect(f.authenticator.passwordHash.value).toBe("replacement");
  });
  it("rejects confirmation mismatch before any token lookup", async () => {
    const f = await fixture();
    expect(
      await f.useCase.execute({
        ...f.input,
        passwordConfirmation: "different",
      }),
    ).toEqual({
      success: false,
      error: { code: "password.confirmation_mismatch" },
    });
    expect(f.store.find).not.toHaveBeenCalled();
  });
});
