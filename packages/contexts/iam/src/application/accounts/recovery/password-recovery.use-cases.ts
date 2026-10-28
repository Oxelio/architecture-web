import { Result } from "@architecture/foundation";

import type { PasswordPolicyReader } from "#accounts/password-policy/password-policy.reader";
import type { PasswordValidation } from "#accounts/password-policy/password-validation";
import type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityContext,
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import type { IamResult } from "#application-result";
import type { PasswordHasher } from "#authentication/password/password-hasher.port";
import { selectPasswordPolicyProfile } from "#domain/password-policy";
import { isRecoveryTokenUsable } from "#domain/recovery-token";
import type { LoginIdentityRepository } from "#repositories/login-identity.repository";
import type { PasswordAuthenticatorRepository } from "#repositories/password-authenticator.repository";
import type { SessionRepository } from "#repositories/session.repository";
import type { UserRepository } from "#repositories/user.repository";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import type { PasswordRecoveryStore } from "./password-recovery.store.js";
import type { RecoveryPolicyReader } from "./recovery-policy.reader.js";

export class RequestPasswordRecoveryUseCase {
  constructor(
    private readonly policies: RecoveryPolicyReader,
    private readonly identities: LoginIdentityRepository,
    private readonly users: UserRepository,
    private readonly store: PasswordRecoveryStore,
    private readonly tokens: SecurityTokens,
    private readonly mail: AccountSecurityMail,
    private readonly origins: RecoveryOriginLimiter,
    private readonly events: SecurityEventRecorder,
  ) {}
  async execute(input: {
    email: string;
    context: SecurityContext;
  }): Promise<IamResult<void>> {
    const login = LoginIdentifierValueObject.create("email", input.email);
    if (!login.success) {
      return Result.failure({ code: "EMAIL_INVALID" } as const);
    }
    const policy = await this.policies.getRecoveryPolicy();
    const identity = await this.identities.findByLogin(login.value);
    const user = identity ? await this.users.findById(identity.userId) : null;
    const origin = input.context.ipAddress
      ? await this.origins.countRecent(
          this.tokens.hash(input.context.ipAddress),
          new Date(Date.now() - 3600000),
        )
      : 0;
    if (
      policy.enabled &&
      identity?.verificationStatus === "verified" &&
      user?.status.isActive() &&
      origin < policy.requestsPerHour * 4
    ) {
      const token = this.tokens.generate(),
        now = new Date();
      const issued = await this.store.issue({
        id: this.tokens.identifier(),
        userId: user.identifier.value,
        tokenHash: this.tokens.hash(token),
        emailFingerprint: this.tokens.hash(login.value.value),
        expiresAt: new Date(now.getTime() + policy.tokenMinutes * 60000),
        now,
        maximumPerHour: policy.requestsPerHour,
      });
      if (issued) {
        await this.mail.sendRecovery(login.value.value, token);
      }
    }
    await this.events.record(
      "account.recovery.requested",
      "success",
      {
        ...input.context,
        actorType: "anonymous",
        ...(user ? { subjectId: user.identifier.value } : {}),
      },
      { emailFingerprint: this.tokens.hash(login.value.value) },
    );
    return Result.success(undefined);
  }
}

export class ResetRecoveredPasswordUseCase {
  constructor(
    private readonly store: PasswordRecoveryStore,
    private readonly users: UserRepository,
    private readonly authenticators: PasswordAuthenticatorRepository,
    private readonly identities: LoginIdentityRepository,
    private readonly policies: PasswordPolicyReader,
    private readonly validation: Pick<PasswordValidation, "validate">,
    private readonly hasher: PasswordHasher,
    private readonly tokens: SecurityTokens,
    private readonly sessions: SessionRepository,
  ) {}
  async execute(input: {
    token: string;
    password: string;
    passwordConfirmation: string;
    context: SecurityContext;
  }): Promise<IamResult<void>> {
    const invalid = () =>
      Result.failure({ code: "RECOVERY_TOKEN_INVALID" } as const);
    if (input.password !== input.passwordConfirmation) {
      return Result.failure({
        code: "password.confirmation_mismatch",
      } as const);
    }
    const tokenHash = this.tokens.hash(input.token),
      now = new Date();
    const recovery = await this.store.find(tokenHash);
    if (!recovery || !isRecoveryTokenUsable(recovery, now)) {
      return invalid();
    }
    const id = UserIdentifierValueObject.create(recovery.userId);
    if (!id.success) {
      return invalid();
    }
    const user = await this.users.findById(id.value),
      authenticator = await this.authenticators.findForUser(id.value);
    if (
      !user ||
      !authenticator ||
      authenticator.isRevoked ||
      user.status.value === "pending_deletion"
    ) {
      return invalid();
    }
    const policy = await this.policies.get(
      selectPasswordPolicyProfile(user.role),
    );
    const identities = await this.identities.listForUser(user.identifier);
    const context = Object.fromEntries(
      identities.map((identity) => [identity.login.kind, identity.login.value]),
    );
    const validation = await this.validation.validate(policy, {
      password: input.password,
      confirmation: input.passwordConfirmation,
      context,
    });
    if (validation.errors[0]) {
      return Result.failure(validation.errors[0]);
    }
    const plain = PasswordPlainValueObject.create(input.password);
    if (!plain.success) {
      return Result.failure(plain.error);
    }
    if (
      policy.rejectCurrentPassword &&
      (await this.hasher.verify(plain.value, authenticator.passwordHash))
    ) {
      return Result.failure({ code: "password.reused" } as const);
    }
    const hash = await this.hasher.hash(plain.value);
    const result = await this.store.withUsableToken(
      tokenHash,
      new Date(),
      async (commit) => {
        if (
          !commit.user.role.equals(user.role) ||
          commit.user.status.value === "pending_deletion" ||
          !commit.authenticator.passwordHash.equals(authenticator.passwordHash)
        ) {
          return invalid();
        }
        await commit.consume();
        commit.authenticator.changePassword(hash);
        commit.user.invalidateSessions();
        await commit.passwordAuthenticators.save(commit.authenticator);
        await commit.users.save(commit.user);
        return Result.success(undefined);
      },
    );
    if (!result || !result.success) {
      return result ?? invalid();
    }
    await this.sessions.deleteAllForUser(user.identifier);
    return result;
  }
}
