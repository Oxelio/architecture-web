import { describe, expect, it, vi } from "vitest";

import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { PublishedIamPolicies } from "#access-administration/security-configuration/published-iam-policies";
import type { RecoveryCommit } from "#accounts/recovery/password-recovery.store";
import type { MfaChallenge } from "#domain/mfa";
import { DEFAULT_SECURITY_POLICY } from "#domain/security-policy";
import { LoginIdentityEntity } from "#entities/login-identity.entity";
import { PasswordAuthenticatorEntity } from "#entities/password-authenticator.entity";
import { SessionEntity } from "#entities/session.entity";
import { UserEntity } from "#entities/user.entity";
import {
  InMemoryEmailVerificationRepository,
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "#test/in-memory-repositories";
import { InMemoryIamUnitOfWork } from "#test/in-memory-unit-of-work";
import { testPasswordHash } from "#test/test-policies";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import {
  createIam,
  type IamApplication,
  type IamDependencies,
} from "./create-iam.js";

function fixture() {
  const users = new InMemoryUserRepository();
  const identities = new InMemoryLoginIdentityRepository();
  const passwords = new InMemoryPasswordAuthenticatorRepository();
  const verifications = new InMemoryEmailVerificationRepository();
  const policy = structuredClone(DEFAULT_SECURITY_POLICY);
  policy.accounts.export = true;
  policy.authentication.mfaAvailable = true;
  policy.sessions.durationMinutes = 30;
  policy.passwords.rejectCurrentPassword = false;
  const mfa = {
    credential: vi.fn<IamDependencies["mfa"]["credential"]>(),
    remainingBackupCodes:
      vi.fn<IamDependencies["mfa"]["remainingBackupCodes"]>(),
    beginEnrollment: vi.fn<IamDependencies["mfa"]["beginEnrollment"]>(),
    confirmEnrollment: vi.fn<IamDependencies["mfa"]["confirmEnrollment"]>(),
    activate: vi.fn<IamDependencies["mfa"]["activate"]>(),
    findChallenge: vi.fn<IamDependencies["mfa"]["findChallenge"]>(),
    beginChallenge: vi.fn<IamDependencies["mfa"]["beginChallenge"]>(),
    verify: vi.fn<IamDependencies["mfa"]["verify"]>(),
    replaceBackupCodes: vi.fn<IamDependencies["mfa"]["replaceBackupCodes"]>(),
    disable: vi.fn<IamDependencies["mfa"]["disable"]>(),
  } satisfies IamDependencies["mfa"];
  const crypto = {
    generateSecret: vi.fn<IamDependencies["crypto"]["generateSecret"]>(),
    seal: vi.fn<IamDependencies["crypto"]["seal"]>(),
    open: vi.fn<IamDependencies["crypto"]["open"]>(),
    verifyTotp: vi.fn<IamDependencies["crypto"]["verifyTotp"]>(),
    generateBackupCodes:
      vi.fn<IamDependencies["crypto"]["generateBackupCodes"]>(),
    qrCode: vi.fn<IamDependencies["crypto"]["qrCode"]>(),
  } satisfies IamDependencies["crypto"];
  const configuration = {
    initialize: vi.fn<IamDependencies["configuration"]["initialize"]>(),
    readCenter: vi.fn<IamDependencies["configuration"]["readCenter"]>(),
    history: vi.fn<IamDependencies["configuration"]["history"]>(),
    find: vi.fn<IamDependencies["configuration"]["find"]>(),
    publish: vi.fn<IamDependencies["configuration"]["publish"]>(),
    countAdministratorsWithoutMfa:
      vi.fn<
        IamDependencies["configuration"]["countAdministratorsWithoutMfa"]
      >(),
    readPublished: vi.fn<IamDependencies["configuration"]["readPublished"]>(),
  } satisfies IamDependencies["configuration"];
  const exports = {
    reserve: vi.fn<IamDependencies["exports"]["reserve"]>(),
    readData: vi.fn<IamDependencies["exports"]["readData"]>(),
    complete: vi.fn<IamDependencies["exports"]["complete"]>(),
    fail: vi.fn<IamDependencies["exports"]["fail"]>(),
    list: vi.fn<IamDependencies["exports"]["list"]>(),
    take: vi.fn<IamDependencies["exports"]["take"]>(),
    expire: vi.fn<IamDependencies["exports"]["expire"]>(),
  } satisfies IamDependencies["exports"];
  const deletions = {
    request: vi.fn<IamDependencies["deletions"]["request"]>(),
    find: vi.fn<IamDependencies["deletions"]["find"]>(),
    cancel: vi.fn<IamDependencies["deletions"]["cancel"]>(),
    due: vi.fn<IamDependencies["deletions"]["due"]>(),
    eraseIfDue: vi.fn<IamDependencies["deletions"]["eraseIfDue"]>(),
  } satisfies IamDependencies["deletions"];
  const recovery = {
    find: vi.fn<IamDependencies["recovery"]["find"]>(),
    issue: vi.fn<IamDependencies["recovery"]["issue"]>(),
    withUsableToken: async <T>(
      _hash: string,
      _now: Date,
      _work: (commit: RecoveryCommit) => Promise<T>,
    ): Promise<T | null> => null,
  } satisfies IamDependencies["recovery"];
  const sessionRepository = {
    save: vi.fn<IamDependencies["sessionRepository"]["save"]>(),
    saveEnforcingMaximum:
      vi.fn<IamDependencies["sessionRepository"]["saveEnforcingMaximum"]>(),
    findById: vi.fn<IamDependencies["sessionRepository"]["findById"]>(),
    delete: vi.fn<IamDependencies["sessionRepository"]["delete"]>(),
    deleteAllForUser:
      vi.fn<IamDependencies["sessionRepository"]["deleteAllForUser"]>(),
    updateLastActivity:
      vi.fn<IamDependencies["sessionRepository"]["updateLastActivity"]>(),
    findActiveForUser:
      vi.fn<IamDependencies["sessionRepository"]["findActiveForUser"]>(),
  } satisfies IamDependencies["sessionRepository"];
  const revision = {
    id: "current-revision",
    version: 2,
    values: policy,
    createdBy: "administrator",
    createdAt: new Date(),
    previousRevisionId: null,
  };
  configuration.readPublished.mockImplementation(async () => revision);
  configuration.find.mockResolvedValue({
    ...revision,
    id: "d0af72cd-e3e8-41bf-bfe1-ff37b54c8bf3",
    version: 1,
  });
  configuration.publish.mockImplementation(async (input) => ({
    ...revision,
    version: 3,
    values: input.values,
  }));
  const sessions = new Map<string, SessionEntity>();
  sessionRepository.saveEnforcingMaximum.mockImplementation(async (session) => {
    sessions.set(session.identifier.value, session);
  });
  sessionRepository.findById.mockImplementation(
    async (id) => sessions.get(id.value) ?? null,
  );
  sessionRepository.findActiveForUser.mockImplementation(async (id) =>
    [...sessions.values()].filter((s) => s.userId.equals(id)),
  );
  mfa.credential.mockResolvedValue(null);
  const challenges = new Map<string, MfaChallenge>();
  mfa.beginChallenge.mockImplementation(async (input) => {
    const challenge: MfaChallenge = {
      ...input,
      purpose: "signin",
      attempts: 0,
      consumedAt: null,
    };
    challenges.set(challenge.id, challenge);
    return challenge;
  });
  mfa.findChallenge.mockImplementation(
    async (id) => challenges.get(id) ?? null,
  );
  mfa.verify.mockResolvedValue("totp");
  crypto.open.mockReturnValue("test-factor");
  crypto.verifyTotp.mockReturnValue(17);
  const passwordHasher = {
    hash: vi.fn<IamDependencies["passwordHasher"]["hash"]>(async () =>
      testPasswordHash("replacement"),
    ),
    verify: vi.fn<IamDependencies["passwordHasher"]["verify"]>(
      async () => true,
    ),
    fakeVerify: vi.fn<IamDependencies["passwordHasher"]["fakeVerify"]>(),
  };
  const strength = {
    evaluate: vi.fn<IamDependencies["passwordStrengthEvaluator"]["evaluate"]>(
      async () => "very_strong",
    ),
  };
  const common = { isCommon: vi.fn(async () => false) },
    compromised = { isCompromised: vi.fn(async () => false) };
  const outbox = { append: vi.fn<IamDependencies["outbox"]["append"]>() };
  const events = { record: vi.fn<IamDependencies["events"]["record"]>() };
  const dependencies = {
    userRepository: users,
    userQueryRepository: new InMemoryUserQueryRepository(users, identities),
    loginIdentityRepository: identities,
    passwordAuthenticatorRepository: passwords,
    sessionRepository,
    passwordHasher,
    policies: new PublishedIamPolicies(configuration),
    passwordStrengthEvaluator: strength,
    commonPasswordChecker: common,
    compromisedPasswordChecker: compromised,
    emailSender: { sendVerificationEmail: vi.fn() },
    emailVerificationRepository: verifications,
    rateLimiter: { isAllowed: vi.fn(), recordSuccess: vi.fn() },
    emailVerificationTokenHasher: { hash: vi.fn() },
    unitOfWork: new InMemoryIamUnitOfWork(
      users,
      identities,
      passwords,
      verifications,
    ),
    outbox,
    configuration,
    recovery,
    mfa,
    exports,
    deletions,
    crypto,
    tokens: {
      identifier: () => "04fbaeb5-1293-4ab7-beb2-80c74215b4d2",
      generate: () => "test-token",
      hash: (value: string) => "hashed:" + value,
    },
    mail: { sendRecovery: vi.fn(), sendDeletionCancellation: vi.fn() },
    events,
    origins: { countRecent: vi.fn() },
    audit: { exportFor: vi.fn(), pseudonymize: vi.fn() },
    archive: { build: vi.fn() },
  } satisfies IamDependencies;
  async function account(admin = false) {
    const user = UserEntity.create();
    if (admin) {
      user.changeRole(UserRoleValueObject.admin());
    }
    const login = LoginIdentifierValueObject.create(
      "username",
      "composition-user",
    );
    if (!login.success) {
      throw new Error("Invalid composition fixture");
    }
    await users.save(user);
    await identities.save(
      LoginIdentityEntity.create({
        userId: user.identifier,
        login: login.value,
        verificationRequired: false,
      }),
    );
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: user.identifier,
      passwordHash: testPasswordHash(),
    });
    await passwords.save(authenticator);
    return { user, authenticator };
  }
  function recentSession(user: UserEntity) {
    const session = SessionEntity.createForUser({
      userId: user.identifier,
      userSessionVersion: user.sessionVersion,
      expiresAt: new Date(Date.now() + 60000),
    });
    sessions.set(session.identifier.value, session);
    return session;
  }
  function enableMfa(user: UserEntity) {
    mfa.credential.mockResolvedValue({
      userId: user.identifier.value,
      sealedSecret: "sealed-factor",
      enabledAt: new Date(),
      enrollmentExpiresAt: null,
      lastCounter: null,
    });
  }
  return {
    iam: createIam(dependencies),
    dependencies,
    users,
    identities,
    passwords,
    sessionRepository,
    sessions,
    passwordHasher,
    policy,
    configuration,
    revision,
    mfa,
    crypto,
    outbox,
    events,
    strength,
    common,
    compromised,
    recovery,
    exports,
    account,
    recentSession,
    enableMfa,
  };
}

const loginInput = {
  login: { kind: "username" as const, value: "composition-user" },
  password: "current password",
};
const replacement = "a long and sufficiently strong replacement phrase";

describe("createIam", () => {
  it("shares administrator authorization across account and configuration administration", async () => {
    const f = fixture(),
      administration = f.iam.administration;
    const authorizers = new Set<AdministratorAuthorizer>();
    const authorize = AdministratorAuthorizer.prototype.authorize;
    const spy = vi
      .spyOn(AdministratorAuthorizer.prototype, "authorize")
      .mockImplementation(function (this: AdministratorAuthorizer, actorId) {
        authorizers.add(this);
        return authorize.call(this, actorId);
      });
    const actorUserId = "invalid-actor",
      userId = "invalid-target";
    const actorId = actorUserId,
      values = f.policy,
      expectedVersion = 2,
      justification = "composition test",
      confirmedCritical = true;
    const attempts = [
      () => administration.activateUser.execute({ actorUserId, userId }),
      () =>
        administration.assignUserRole.execute({
          actorUserId,
          userId,
          role: "user",
        }),
      () => administration.listUsers.execute({ actorUserId }),
      () =>
        administration.getUserAdministrationOverview.execute({ actorUserId }),
      () => administration.suspendUser.execute({ actorUserId, userId }),
      () => administration.listUserSessions.execute({ actorUserId, userId }),
      () => administration.revokeUserSession.execute({ actorUserId, userId }),
      () => administration.getConfiguration.execute(actorId),
      () => administration.previewConfiguration.execute({ actorId, values }),
      () =>
        administration.publishConfiguration.execute({
          actorId,
          values,
          expectedVersion,
          justification,
          confirmedCritical,
        }),
      () =>
        administration.restoreConfiguration.execute({
          actorId,
          revisionId: "d0af72cd-e3e8-41bf-bfe1-ff37b54c8bf3",
          expectedVersion,
          justification,
          confirmedCritical,
        }),
    ];
    try {
      for (const attempt of attempts) {
        expect(await attempt()).toEqual({
          success: false,
          error: { code: "administrator.unauthorized" },
        });
      }
      expect(spy).toHaveBeenCalledTimes(11);
      expect(authorizers.size).toBe(1);
      expect(f.configuration.publish).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("exposes all 41 operation contracts through their owning capabilities without performing I/O", () => {
    const f = fixture();
    const expected = {
      accounts: [
        "changeEmail",
        "changePassword",
        "getCurrentAccount",
        "getPasswordPolicy",
        "evaluatePassword",
        "resendEmailVerification",
        "signUp",
        "verifyEmail",
        "requestRecovery",
        "resetPassword",
        "requestExport",
        "listExports",
        "downloadExport",
        "requestDeletion",
        "cancelDeletion",
        "maintainAccounts",
      ],
      authentication: [
        "listCurrentUserSessions",
        "resolveSession",
        "revokeCurrentUserSession",
        "signIn",
        "signOut",
        "beginMfaEnrollment",
        "confirmMfaEnrollment",
        "activateMfa",
        "getMfaStatus",
        "beginSecondFactor",
        "completeMfaSignIn",
        "regenerateBackupCodes",
        "disableMfa",
      ],
      administration: [
        "assignUserRole",
        "activateUser",
        "getUserAdministrationOverview",
        "listUsers",
        "listUserSessions",
        "revokeUserSession",
        "suspendUser",
        "getCapabilities",
        "getConfiguration",
        "previewConfiguration",
        "publishConfiguration",
        "restoreConfiguration",
      ],
    } satisfies {
      [K in keyof IamApplication]: readonly (keyof IamApplication[K])[];
    };
    expect(Object.keys(f.iam).sort()).toEqual(Object.keys(expected).sort());
    for (const capability of [
      "accounts",
      "authentication",
      "administration",
    ] as const) {
      expect(Object.keys(f.iam[capability]).sort()).toEqual(
        [...expected[capability]].sort(),
      );
      for (const operation of Object.values(f.iam[capability])) {
        expect(operation.execute).toBeTypeOf("function");
      }
    }
    expect(f.configuration.readPublished).not.toHaveBeenCalled();
    expect(f.mfa.credential).not.toHaveBeenCalled();
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "issues a session with the same configured lifetime and outbox through MFA=%s",
    async (mfa) => {
      const f = fixture(),
        { user } = await f.account();
      if (mfa) {
        f.enableMfa(user);
      }
      const before = Date.now();
      const metadata = {
        client: {
          type: "browser" as const,
          name: "composition-browser",
          deviceType: "desktop" as const,
        },
      };
      const signedIn = await f.iam.authentication.signIn.execute({
        ...loginInput,
        ...metadata,
      });
      expect(signedIn.success).toBe(true);
      if (!signedIn.success) {
        throw new Error("Expected sign-in success");
      }
      let result:
        | Awaited<
            ReturnType<IamApplication["authentication"]["signIn"]["execute"]>
          >
        | Awaited<
            ReturnType<
              IamApplication["authentication"]["completeMfaSignIn"]["execute"]
            >
          > = signedIn;
      if (mfa) {
        expect(signedIn.value).toMatchObject({
          mfaRequired: true,
          sessionId: null,
        });
        expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
        expect(f.outbox.append).not.toHaveBeenCalled();
        if (!("challengeId" in signedIn.value)) {
          throw new Error("Expected second-factor challenge");
        }
        result = await f.iam.authentication.completeMfaSignIn.execute({
          challengeId: signedIn.value.challengeId,
          code: "123456",
          metadata,
        });
        expect(f.mfa.verify).toHaveBeenCalledWith(
          expect.objectContaining({
            counter: 17,
            backupHash: "hashed:123456",
            challengeId: signedIn.value.challengeId,
          }),
        );
        expect(f.events.record).toHaveBeenCalledWith(
          "authentication.signin",
          "success",
          expect.objectContaining({ actorId: user.identifier.value }),
          { secondFactor: "totp" },
        );
      }
      expect(result).toMatchObject({
        success: true,
        value: { userId: user.identifier.value, sessionId: expect.any(String) },
      });
      expect(f.sessionRepository.saveEnforcingMaximum).toHaveBeenCalledOnce();
      const call = f.sessionRepository.saveEnforcingMaximum.mock.calls[0];
      if (!call) {
        throw new Error("Expected session issuance");
      }
      const [session, maximum] = call;
      expect(maximum).toBe(10);
      expect(session.client).toEqual(metadata.client);
      expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60000,
      );
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60000,
      );
      expect(f.outbox.append).toHaveBeenCalledOnce();
      expect(f.outbox.append).toHaveBeenCalledWith([
        expect.objectContaining({ topic: "iam.session-started" }),
      ]);
      expect(
        await f.iam.authentication.resolveSession.execute({
          sessionId: session.identifier.value,
        }),
      ).toMatchObject({
        success: true,
        value: { userId: user.identifier.value },
      });
    },
  );

  it("uses the exposed second-factor operation inside sign-in and preserves its captured policy", async () => {
    const f = fixture();
    await f.account();
    const gate = vi.spyOn(f.iam.authentication.beginSecondFactor, "execute");
    await f.iam.authentication.signIn.execute(loginInput);
    expect(gate).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: f.policy.authentication,
        expectedSessionVersion: 1,
      }),
    );
    expect(f.configuration.readPublished).toHaveBeenCalledOnce();
  });

  it("requires enrollment when the persisted role requires MFA", async () => {
    const f = fixture();
    await f.account(true);
    f.policy.authentication.mfaRequiredRoles = ["admin"];
    expect(await f.iam.authentication.signIn.execute(loginInput)).toEqual({
      success: false,
      error: { code: "mfa.enrollment_required" },
    });
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
    expect(f.mfa.beginChallenge).not.toHaveBeenCalled();
  });

  it("rejects a session generation changed after password verification", async () => {
    const f = fixture(),
      { user } = await f.account();
    f.enableMfa(user);
    const original = f.passwords.recordSuccessfulUse.bind(f.passwords);
    vi.spyOn(f.passwords, "recordSuccessfulUse").mockImplementation(
      async (credential) => {
        const result = await original(credential);
        const current = UserEntity.rehydrate({
          identifier: user.identifier,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          sessionVersion: user.sessionVersion + 1,
        });
        await f.users.save(current);
        return result;
      },
    );
    expect(await f.iam.authentication.signIn.execute(loginInput)).toEqual({
      success: false,
      error: { code: "mfa.invalid_challenge" },
    });
    expect(f.mfa.beginChallenge).not.toHaveBeenCalled();
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
  });

  it("rejects completing MFA after the account generation changes", async () => {
    const f = fixture(),
      { user } = await f.account();
    f.enableMfa(user);
    const result = await f.iam.authentication.signIn.execute(loginInput);
    if (!result.success || !("challengeId" in result.value)) {
      throw new Error("Expected challenge");
    }
    user.invalidateSessions();
    expect(
      await f.iam.authentication.completeMfaSignIn.execute({
        challengeId: result.value.challengeId,
        code: "123456",
      }),
    ).toEqual({ success: false, error: { code: "mfa.invalid_challenge" } });
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
  });

  it("preserves a factor refusal without issuing a session", async () => {
    const f = fixture(),
      { user } = await f.account();
    f.enableMfa(user);
    const result = await f.iam.authentication.signIn.execute(loginInput);
    if (!result.success || !("challengeId" in result.value)) {
      throw new Error("Expected challenge");
    }
    f.mfa.verify.mockResolvedValue(null);
    expect(
      await f.iam.authentication.completeMfaSignIn.execute({
        challengeId: result.value.challengeId,
        code: "invalid",
      }),
    ).toEqual({ success: false, error: { code: "mfa.invalid_challenge" } });
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
    expect(f.outbox.append).not.toHaveBeenCalled();
  });

  it.each([
    "signUp",
    "changePassword",
    "resetPassword",
    "evaluatePassword",
  ] as const)("uses the injected password checks for %s", async (operation) => {
    const f = fixture(),
      { user } = await f.account();
    f.policy.passwords.checkCompromisedPasswords = true;
    f.compromised.isCompromised.mockResolvedValue(true);
    f.recovery.find.mockResolvedValue({
      id: "recovery",
      userId: user.identifier.value,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
      invalidatedAt: null,
    });
    const input = { password: replacement, passwordConfirmation: replacement };
    const result =
      operation === "signUp"
        ? await f.iam.accounts.signUp.execute({
            ...input,
            login: { kind: "username", value: "new-composition-user" },
          })
        : operation === "changePassword"
          ? await f.iam.accounts.changePassword.execute({
              ...input,
              userId: user.identifier.value,
              currentPassword: "current password",
            })
          : operation === "resetPassword"
            ? await f.iam.accounts.resetPassword.execute({
                ...input,
                token: "recovery",
                context: { actorType: "anonymous" },
              })
            : await f.iam.accounts.evaluatePassword.execute({
                password: replacement,
              });
    if (operation === "evaluatePassword") {
      expect(result).toMatchObject({
        valid: false,
        errorCodes: expect.arrayContaining(["password.compromised"]),
      });
    } else {
      expect(result).toEqual({
        success: false,
        error: { code: "password.compromised" },
      });
    }
    expect(f.strength.evaluate.mock.calls[0]?.[0]).toBe(replacement);
    expect(f.compromised.isCompromised).toHaveBeenCalledWith(replacement);
    expect(f.passwordHasher.hash).not.toHaveBeenCalled();
    expect(f.sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });

  it("registers and changes a password through the supplied transactional repositories", async () => {
    const f = fixture();
    const registered = await f.iam.accounts.signUp.execute({
      ...loginInput,
      password: replacement,
      passwordConfirmation: replacement,
    });
    expect(registered.success).toBe(true);
    const user = [...f.users.values.values()][0];
    if (!user) {
      throw new Error("Expected registered account");
    }
    const changed = await f.iam.accounts.changePassword.execute({
      userId: user.identifier.value,
      currentPassword: replacement,
      password: replacement + " changed",
      passwordConfirmation: replacement + " changed",
    });
    expect(changed).toEqual({ success: true, value: undefined });
    expect(user.sessionVersion).toBe(2);
    expect(f.passwordHasher.hash).toHaveBeenCalledTimes(2);
    expect(f.sessionRepository.deleteAllForUser).toHaveBeenCalledWith(
      user.identifier,
    );
  });

  it("completes recovery through the supplied commit and session ports without issuing a session", async () => {
    const f = fixture(),
      { user, authenticator } = await f.account();
    f.recovery.find.mockResolvedValue({
      id: "recovery",
      userId: user.identifier.value,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
      invalidatedAt: null,
    });
    const consume = vi.fn(async () => undefined);
    f.recovery.withUsableToken = async (_hash, _now, work) =>
      work({
        user,
        authenticator,
        users: f.users,
        passwordAuthenticators: f.passwords,
        consume,
      });
    expect(
      await f.iam.accounts.resetPassword.execute({
        token: "recovery",
        password: replacement,
        passwordConfirmation: replacement,
        context: { actorType: "anonymous" },
      }),
    ).toEqual({ success: true, value: undefined });
    expect(consume).toHaveBeenCalledOnce();
    expect(authenticator.passwordHash).toEqual(testPasswordHash("replacement"));
    expect(user.sessionVersion).toBe(2);
    expect(f.sessionRepository.deleteAllForUser).toHaveBeenCalledWith(
      user.identifier,
    );
    expect(f.sessionRepository.saveEnforcingMaximum).not.toHaveBeenCalled();
  });

  it.each(["accounts", "authentication", "administration"] as const)(
    "enforces fresh password proof for sensitive %s operations",
    async (capability) => {
      const f = fixture(),
        { user } = await f.account(true),
        session = f.recentSession(user);
      f.enableMfa(user);
      f.passwordHasher.verify.mockResolvedValue(false);
      const proof = {
        userId: user.identifier.value,
        sessionId: session.identifier.value,
        password: "wrong",
      };
      const changed = structuredClone(f.policy);
      changed.audit.retentionDays += 1;
      const result =
        capability === "accounts"
          ? await f.iam.accounts.requestExport.execute(proof)
          : capability === "authentication"
            ? await f.iam.authentication.beginMfaEnrollment.execute(proof)
            : await f.iam.administration.publishConfiguration.execute({
                actorId: user.identifier.value,
                ...proof,
                values: changed,
                expectedVersion: 2,
                justification: "composition test",
                confirmedCritical: true,
                mfaCode: "123456",
              });
      expect(result).toEqual({
        success: false,
        error: { code: "authentication.invalid_credentials" },
      });
      expect(f.passwordHasher.verify).toHaveBeenCalledOnce();
      expect(f.exports.reserve).not.toHaveBeenCalled();
      expect(f.mfa.beginEnrollment).not.toHaveBeenCalled();
      expect(f.configuration.publish).not.toHaveBeenCalled();
      expect(f.mfa.verify).not.toHaveBeenCalled();
    },
  );

  it("shares MFA verification with account export reauthentication", async () => {
    const f = fixture(),
      { user } = await f.account(),
      session = f.recentSession(user);
    f.enableMfa(user);
    f.exports.reserve.mockResolvedValue({
      id: "existing-export",
      status: "ready",
      created: false,
    });
    expect(
      await f.iam.accounts.requestExport.execute({
        userId: user.identifier.value,
        sessionId: session.identifier.value,
        password: "current password",
        code: "123456",
      }),
    ).toEqual({
      success: true,
      value: { id: "existing-export", status: "ready" },
    });
    expect(f.mfa.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.identifier.value,
        counter: 17,
        backupHash: "hashed:123456",
      }),
    );
  });

  it("restores through the exposed publication operation and preserves proof generation and origin", async () => {
    const f = fixture(),
      { user } = await f.account(true),
      session = f.recentSession(user);
    f.enableMfa(user);
    const target = structuredClone(f.policy);
    target.audit.retentionDays += 1;
    f.configuration.find.mockResolvedValue({
      ...f.revision,
      id: "d0af72cd-e3e8-41bf-bfe1-ff37b54c8bf3",
      version: 1,
      values: target,
    });
    const publish = vi.spyOn(
      f.iam.administration.publishConfiguration,
      "execute",
    );
    const result = await f.iam.administration.restoreConfiguration.execute({
      actorId: user.identifier.value,
      revisionId: "d0af72cd-e3e8-41bf-bfe1-ff37b54c8bf3",
      expectedVersion: 2,
      justification: "restore policy",
      confirmedCritical: true,
      sessionId: session.identifier.value,
      password: "current password",
      mfaCode: "123456",
    });
    expect(result.success).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "restoration",
        restoredFromRevisionId: "d0af72cd-e3e8-41bf-bfe1-ff37b54c8bf3",
        values: target,
      }),
    );
    expect(f.configuration.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedActorSessionVersion: user.sessionVersion,
        origin: "restoration",
        expectedVersion: 2,
      }),
    );
    expect(f.events.record.mock.calls.map((call) => call[0])).toEqual([
      "security.config.publication-attempt",
      "security.config.restoration-attempt",
    ]);
  });

  it.each(["policy", "factor", "session", "outbox", "checker"] as const)(
    "propagates unexpected %s failures through the composed application",
    async (boundary) => {
      const f = fixture(),
        { user } = await f.account(),
        failure = new Error("technical failure");
      if (boundary === "policy") {
        f.configuration.readPublished.mockRejectedValue(failure);
      }
      if (boundary === "factor") {
        f.enableMfa(user);
        f.mfa.beginChallenge.mockRejectedValue(failure);
      }
      if (boundary === "session") {
        f.sessionRepository.saveEnforcingMaximum.mockRejectedValue(failure);
      }
      if (boundary === "outbox") {
        f.outbox.append.mockRejectedValue(failure);
      }
      if (boundary === "checker") {
        f.strength.evaluate.mockRejectedValue(failure);
      }
      const result =
        boundary === "checker"
          ? f.iam.accounts.evaluatePassword.execute({ password: replacement })
          : f.iam.authentication.signIn.execute(loginInput);
      await expect(result).rejects.toBe(failure);
      if (boundary === "session") {
        expect(f.outbox.append).not.toHaveBeenCalled();
      }
    },
  );
});
