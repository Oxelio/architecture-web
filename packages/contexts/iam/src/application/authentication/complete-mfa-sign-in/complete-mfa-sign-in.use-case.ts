import { Result } from "@architecture/foundation";

import type { SecurityEventRecorder } from "#accounts/security-effects";
import type { IssueSession } from "#authentication/issue-session";
import type { MfaStore } from "#authentication/mfa/mfa.ports";
import type { FactorVerification } from "#authentication/reauthentication";
import { isMfaChallengeUsable } from "#domain/mfa";
import { isSecurityOperationId } from "#domain/security-operation-id";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  type CompleteMfaSignIn,
  CompleteMfaSignInErrors,
  type CompleteMfaSignInInput,
  type CompleteMfaSignInOutput,
} from "./complete-mfa-sign-in.contracts.js";

export class CompleteMfaSignInUseCase implements CompleteMfaSignIn {
  constructor(
    private readonly store: MfaStore,
    private readonly factor: FactorVerification,
    private readonly users: UserRepository,
    private readonly issueSession: IssueSession,
    private readonly events: SecurityEventRecorder,
    private readonly policies: import("#authentication/authentication-policy.reader").SignInPolicyReader,
  ) {}
  async execute(
    input: CompleteMfaSignInInput,
  ): Promise<CompleteMfaSignInOutput> {
    if (!isSecurityOperationId(input.challengeId)) {
      return Result.failure(CompleteMfaSignInErrors.invalidChallenge);
    }

    const captured = await this.policies.getSignInPolicy();
    const challenge = await this.store.findChallenge(input.challengeId);
    if (
      challenge?.purpose !== "signin" ||
      !isMfaChallengeUsable(challenge, new Date())
    ) {
      return Result.failure(CompleteMfaSignInErrors.invalidChallenge);
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
      return Result.failure(CompleteMfaSignInErrors.invalidChallenge);
    }
    const user = await this.users.findById(id.value);
    if (
      !user?.status.isActive() ||
      user.sessionVersion !== challenge.userSessionVersion
    ) {
      return Result.failure(CompleteMfaSignInErrors.invalidChallenge);
    }
    const session = await this.issueSession.issue(
      user,
      input.metadata,
      captured.sessions,
    );
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
