import { Result } from "@architecture/foundation";

import type { PasswordRecoveryStore } from "#accounts/recovery/password-recovery.store";
import type { RecoveryPolicyReader } from "#accounts/recovery/recovery-policy.reader";
import type {
  AccountSecurityMail,
  RecoveryOriginLimiter,
  SecurityEventRecorder,
  SecurityTokens,
} from "#accounts/security-effects";
import type { LoginIdentityRepository } from "#ports/login-identity.repository";
import type { UserRepository } from "#ports/user.repository";
import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";

import {
  type RequestPasswordRecovery,
  RequestPasswordRecoveryErrors,
  type RequestPasswordRecoveryInput,
  type RequestPasswordRecoveryOutput,
} from "./request-password-recovery.contracts.js";

export class RequestPasswordRecoveryUseCase implements RequestPasswordRecovery {
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
  async execute(
    input: RequestPasswordRecoveryInput,
  ): Promise<RequestPasswordRecoveryOutput> {
    const login = LoginIdentifierValueObject.create("email", input.email);
    if (!login.success) {
      return Result.failure(RequestPasswordRecoveryErrors.invalidFormat);
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
        identityId: identity.identifier.value,
        email: login.value.value,
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
