import { Result } from "@architecture/foundation";

import type { SecurityTokens } from "#accounts/security-effects";
import type { AuthenticationPolicyReader } from "#authentication/authentication-policy.reader";
import type { MfaStore } from "#authentication/mfa/mfa.ports";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type BeginSecondFactor,
  BeginSecondFactorErrors,
  type BeginSecondFactorInput,
  type BeginSecondFactorOutput,
} from "./begin-second-factor.contracts.js";

export class BeginSecondFactorUseCase implements BeginSecondFactor {
  constructor(
    private readonly users: UserRepository,
    private readonly policies: AuthenticationPolicyReader,
    private readonly store: MfaStore,
    private readonly tokens: SecurityTokens,
  ) {}
  async execute(
    input: BeginSecondFactorInput,
  ): Promise<BeginSecondFactorOutput> {
    const id = UserIdentifierValueObject.create(input.userId);
    if (!id.success) {
      return Result.failure(BeginSecondFactorErrors.invalidChallenge);
    }
    const user = await this.users.findById(id.value),
      setting = await this.store.credential(input.userId),
      policy = input.policy ?? (await this.policies.getAuthenticationPolicy());
    if (
      !user ||
      !user.status.isActive() ||
      user.sessionVersion !== input.expectedSessionVersion
    ) {
      return Result.failure(BeginSecondFactorErrors.invalidChallenge);
    }
    if (!setting?.enabledAt) {
      return policy.mfaRequiredRoles.includes(user.role.value)
        ? Result.failure(BeginSecondFactorErrors.enrollmentRequired)
        : Result.success(null);
    }
    const now = new Date(),
      challenge = await this.store.beginChallenge({
        id: this.tokens.identifier(),
        userId: input.userId,
        expiresAt: new Date(now.getTime() + policy.mfaChallengeMinutes * 60000),
        maximumAttempts: policy.mfaMaxAttempts,
        userSessionVersion: user.sessionVersion,
        now,
      });
    if (!challenge) {
      return Result.failure(BeginSecondFactorErrors.invalidChallenge);
    }
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
