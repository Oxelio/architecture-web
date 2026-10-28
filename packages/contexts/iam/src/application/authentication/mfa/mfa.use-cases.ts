import { Result } from "@architecture/foundation";

import type {
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import type { IamResult } from "#application-result";
import type { AuthenticationPolicyReader } from "#authentication/authentication-policy.reader";
import type { IssueSession } from "#authentication/issue-session";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import { isMfaChallengeUsable, isMfaEnrollmentUsable } from "#domain/mfa";
import { isSecurityOperationId } from "#domain/security-operation-id";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type { MfaCryptography, MfaStore } from "./mfa.ports.js";

export class BeginMfaEnrollmentUseCase {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly policies: AuthenticationPolicyReader,
    private readonly users: UserRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
  ) {}
  async execute(input: {
    userId: string;
    sessionId: string;
    password: string;
  }): Promise<
    IamResult<{
      secret: string;
      otpauthUri: string;
      qrCodeDataUrl: string;
      expiresAt: Date;
    }>
  > {
    const authorized = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
    );
    if (!authorized.success) {
      return authorized;
    }
    if (!(await this.policies.getAuthenticationPolicy()).mfaAvailable) {
      return Result.failure({ code: "MFA_UNAVAILABLE" } as const);
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    const email = await this.identities.findForUser(id.value, "email"),
      secret = this.crypto.generateSecret(),
      now = new Date(),
      expiresAt = new Date(now.getTime() + 600000);
    if (
      !(await this.store.beginEnrollment(
        {
          userId: input.userId,
          sealedSecret: this.crypto.seal(secret),
          enrollmentExpiresAt: expiresAt,
          enabledAt: null,
          lastCounter: null,
        },
        now,
      ))
    ) {
      return Result.failure({ code: "MFA_ALREADY_ENABLED" } as const);
    }
    const uri = `otpauth://totp/${encodeURIComponent("Architecture")}:${encodeURIComponent(email?.login.value ?? input.userId)}?secret=${secret}&issuer=Architecture&algorithm=SHA1&digits=6&period=30`;
    return Result.success({
      secret,
      otpauthUri: uri,
      qrCodeDataUrl: await this.crypto.qrCode(uri),
      expiresAt,
    });
  }
}
export class ConfirmMfaEnrollmentUseCase {
  constructor(
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(input: {
    userId: string;
    code: string;
  }): Promise<
    IamResult<{ backupCodes: readonly string[]; confirmationId: string }>
  > {
    const setting = await this.store.credential(input.userId),
      now = new Date();
    if (!setting || !isMfaEnrollmentUsable(setting, now)) {
      return Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
    }
    const counter = this.crypto.verifyTotp(
      this.crypto.open(setting.sealedSecret),
      input.code,
    );
    if (counter === null) {
      return Result.failure({ code: "MFA_CODE_INVALID" } as const);
    }
    const backupCodes = this.crypto.generateBackupCodes(),
      confirmationId = this.tokens.identifier();
    const updated = await this.store.confirmEnrollment({
      userId: input.userId,
      sealedSecret: setting.sealedSecret,
      counter,
      backupHashes: backupCodes.map((code) =>
        this.tokens.hash(code.replace(/[\s-]/g, "").toUpperCase()),
      ),
      confirmationId,
      now,
    });
    return updated
      ? Result.success({ backupCodes, confirmationId })
      : Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
  }
}
export class ActivateMfaUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly store: MfaStore,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: {
    userId: string;
    confirmationId: string;
    backupCodesSaved: boolean;
  }): Promise<IamResult<void>> {
    if (!isSecurityOperationId(input.confirmationId)) {
      return Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
    }

    if (!input.backupCodesSaved) {
      return Result.failure({
        code: "MFA_BACKUP_CODES_CONFIRMATION_REQUIRED",
      } as const);
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
    }
    user.invalidateSessions();
    if (
      !(await this.store.activate({
        user,
        confirmationId: input.confirmationId,
        now: new Date(),
      }))
    ) {
      return Result.failure({ code: "MFA_ENROLLMENT_INVALID" } as const);
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return Result.success(undefined);
  }
}
export class GetMfaStatusUseCase {
  constructor(private readonly store: MfaStore) {}
  async execute(input: { userId: string }): Promise<
    IamResult<{
      enabled: boolean;
      enabledAt: Date | null;
      backupCodesRemaining: number;
      lowBackupCodes: boolean;
    }>
  > {
    const setting = await this.store.credential(input.userId),
      remaining = setting?.enabledAt
        ? await this.store.remainingBackupCodes(input.userId)
        : 0;
    return Result.success({
      enabled: Boolean(setting?.enabledAt),
      enabledAt: setting?.enabledAt ?? null,
      backupCodesRemaining: remaining,
      lowBackupCodes: remaining <= 2,
    });
  }
}
export class BeginSecondFactorUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly policies: AuthenticationPolicyReader,
    private readonly store: MfaStore,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(input: {
    userId: string;
  }): Promise<
    Result<
      | import("#authentication/sign-in/sign-in.contracts").SecondFactorChallenge
      | null,
      { code: "MFA_CHALLENGE_INVALID" | "MFA_ENROLLMENT_REQUIRED" }
    >
  > {
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }
    const user = await this.users.findById(id.value),
      setting = await this.store.credential(input.userId),
      policy = await this.policies.getAuthenticationPolicy();
    if (!user || !user.status.isActive()) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }
    if (!setting?.enabledAt) {
      return policy.mfaRequiredRoles.includes(user.role.value)
        ? Result.failure({ code: "MFA_ENROLLMENT_REQUIRED" } as const)
        : Result.success(null);
    }
    const now = new Date(),
      challenge = await this.store.beginChallenge({
        id: this.tokens.identifier(),
        userId: input.userId,
        expiresAt: new Date(now.getTime() + policy.mfaChallengeMinutes * 60000),
        maximumAttempts: policy.mfaMaxAttempts,
        now,
      });
    return Result.success({
      mfaRequired: true as const,
      userId: input.userId,
      sessionId: null,
      sessionExpiresAt: null,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
    });
  }
}
export class CompleteMfaSignInUseCase {
  constructor(
    private readonly store: MfaStore,
    private readonly factor: FactorVerification,
    private readonly users: UserRepository,
    private readonly issueSession: IssueSession,
    private readonly events: SecurityEventRecorder,
  ) {}
  async execute(input: {
    challengeId: string;
    code: string;
    metadata?: Parameters<IssueSession["issue"]>[1];
  }): Promise<
    IamResult<
      import("#authentication/sign-in/sign-in.contracts").AuthenticationSession
    >
  > {
    if (!isSecurityOperationId(input.challengeId)) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }

    const challenge = await this.store.findChallenge(input.challengeId);
    if (
      !challenge ||
      challenge.purpose !== "signin" ||
      !isMfaChallengeUsable(challenge, new Date())
    ) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }
    const verified = await this.factor.verify(
      challenge.userId,
      input.code,
      input.challengeId,
    );
    if (!verified.success) {
      return verified;
    }
    const id = UserIdentifierValueObject.create(challenge.userId);
    if (!id.success) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user || !user.status.isActive()) {
      return Result.failure({ code: "MFA_CHALLENGE_INVALID" } as const);
    }
    const session = await this.issueSession.issue(user, input.metadata);
    await this.events.record(
      "authentication.signin",
      "success",
      {
        actorType: "user",
        actorId: challenge.userId,
        subjectId: challenge.userId,
      },
      { secondFactor: verified.value },
    );
    return Result.success(session);
  }
}
export class RegenerateMfaBackupCodesUseCase {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly factor: FactorVerification,
    private readonly store: MfaStore,
    private readonly crypto: MfaCryptography,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(input: {
    userId: string;
    sessionId: string;
    password: string;
    code: string;
  }): Promise<IamResult<{ backupCodes: readonly string[] }>> {
    const recent = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
    );
    if (!recent.success) {
      return recent;
    }
    const verified = await this.factor.verify(input.userId, input.code);
    if (!verified.success) {
      return verified;
    }
    const backupCodes = this.crypto.generateBackupCodes();
    if (
      !(await this.store.replaceBackupCodes(
        input.userId,
        backupCodes.map((code) =>
          this.tokens.hash(code.replace(/[\s-]/g, "").toUpperCase()),
        ),
        new Date(),
      ))
    ) {
      return Result.failure({ code: "MFA_NOT_ENABLED" } as const);
    }
    return Result.success({ backupCodes });
  }
}
export class DisableMfaUseCase {
  constructor(
    private readonly reauthentication: Reauthentication,
    private readonly factor: FactorVerification,
    private readonly policies: AuthenticationPolicyReader,
    private readonly users: UserRepository,
    private readonly store: MfaStore,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: {
    userId: string;
    sessionId: string;
    password: string;
    code: string;
  }): Promise<IamResult<void>> {
    const recent = await this.reauthentication.recent(
      input.userId,
      input.sessionId,
      input.password,
    );
    if (!recent.success) {
      return recent;
    }
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    const user = await this.users.findById(id.value);
    if (!user) {
      return Result.failure({ code: "USER_NOT_FOUND" } as const);
    }
    if (
      (await this.policies.getAuthenticationPolicy()).mfaRequiredRoles.includes(
        user.role.value,
      )
    ) {
      return Result.failure({ code: "MFA_REQUIRED_BY_POLICY" } as const);
    }
    const factor = await this.factor.verify(input.userId, input.code);
    if (!factor.success) {
      return factor;
    }
    user.invalidateSessions();
    if (!(await this.store.disable(user))) {
      return Result.failure({
        code: "ACCOUNT_CONCURRENT_MODIFICATION",
      } as const);
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return Result.success(undefined);
  }
}
