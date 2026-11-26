import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import type { CriticalConfigurationConfirmation } from "#access-administration/security-configuration/critical-configuration-confirmation";
import {
  changedPolicyKeys,
  CRITICAL_SECURITY_POLICY_KEYS,
  parseSecurityPolicy,
} from "#domain/security-policy";

import {
  type PublishSecurityConfiguration,
  PublishSecurityConfigurationErrors,
  type PublishSecurityConfigurationInput,
  type PublishSecurityConfigurationOutput,
} from "./publish-security-configuration.contracts.js";

export class PublishSecurityConfigurationUseCase implements PublishSecurityConfiguration {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
    private readonly confirmation: Pick<
      CriticalConfigurationConfirmation,
      "verify"
    >,
    private readonly events: import("#accounts/security-effects").SecurityEventRecorder,
  ) {}
  async execute(
    submitted: PublishSecurityConfigurationInput,
    executionStartedAt = performance.now(),
  ): Promise<PublishSecurityConfigurationOutput> {
    const input = {
      ...submitted,
      justification: submitted.justification.trim().slice(0, 500),
    };
    const result = await this.perform(input, executionStartedAt).catch(
      async (error_: unknown) => {
        const operationError = error_;
        try {
          await this.events.record(
            "security.config.publication-attempt",
            "technical_failure",
            {
              actorType: "administrator",
              actorId: input.actorId,
              subjectId: input.actorId,
            },
            {
              expectedVersion: input.expectedVersion,
              origin: input.origin ?? "administration",
              result: "technical_failure",
            },
          );
        } catch (error_) {
          throw new AggregateError(
            [operationError, error_],
            "Configuration operation and failure recording failed",
          );
        }
        throw operationError;
      },
    );
    await this.events.record(
      "security.config.publication-attempt",
      result.success ? "success" : "denied",
      {
        actorType: "administrator",
        actorId: input.actorId,
        subjectId: input.actorId,
      },
      {
        expectedVersion: input.expectedVersion,
        origin: input.origin ?? "administration",
        justification: input.justification,
        ...(input.restoredFromRevisionId
          ? { restoredFromRevisionId: input.restoredFromRevisionId }
          : {}),
        result: result.success ? "published" : result.error.code,
      },
    );
    return result;
  }
  private async perform(
    input: PublishSecurityConfigurationInput,
    executionStartedAt: number,
  ): Promise<PublishSecurityConfigurationOutput> {
    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const parsed = parseSecurityPolicy(input.values);
    if (!parsed.success) {
      return parsed;
    }
    if (!input.justification) {
      return Result.failure(
        PublishSecurityConfigurationErrors.justificationRequired,
      );
    }
    const previous = await this.store.readPublished();
    const changedKeys = changedPolicyKeys(previous.values, parsed.value);
    const critical = changedKeys.some((key) =>
      CRITICAL_SECURITY_POLICY_KEYS.includes(key),
    );
    if (critical && previous.version !== input.expectedVersion) {
      return Result.failure(PublishSecurityConfigurationErrors.versionConflict);
    }
    if (critical && !input.confirmedCritical) {
      return Result.failure(
        PublishSecurityConfigurationErrors.criticalConfirmationRequired,
      );
    }
    let expectedActorSessionVersion: number | undefined;
    if (critical) {
      const proof = await this.confirmation.verify({
        actorId: input.actorId,
        expectedVersion: input.expectedVersion,
        sessionId: input.sessionId ?? "",
        password: input.password ?? "",
        ...(input.mfaCode !== undefined ? { mfaCode: input.mfaCode } : {}),
        authentication: previous.values.authentication,
        startedAt: executionStartedAt,
      });
      if (!proof.success) {
        const errors = PublishSecurityConfigurationErrors;
        const failures = {
          session_invalid: errors.sessionInvalid,
          confirmation_refused: errors.confirmationRefused,
          attempts_exhausted: errors.attemptsExhausted,
          unauthorized: errors.unauthorized,
          version_conflict: errors.versionConflict,
        } as const;
        return Result.failure(failures[proof.error]);
      }
      expectedActorSessionVersion = proof.value;
    }
    const revision = await this.store.publish({
      actorId: input.actorId,
      values: parsed.value,
      expectedVersion: input.expectedVersion,
      justification: input.justification,
      changedKeys,
      ...(expectedActorSessionVersion !== undefined
        ? { expectedActorSessionVersion }
        : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.restoredFromRevisionId
        ? { restoredFromRevisionId: input.restoredFromRevisionId }
        : {}),
    });
    if (revision === "reauthentication_required") {
      return Result.failure(PublishSecurityConfigurationErrors.sessionInvalid);
    }
    if (revision === "last_administrator") {
      return Result.failure(
        PublishSecurityConfigurationErrors.lastActiveAccess,
      );
    }
    if (revision === "unauthorized") {
      return Result.failure(PublishSecurityConfigurationErrors.unauthorized);
    }
    return revision
      ? Result.success({
          id: revision.id,
          version: revision.version,
          effective: revision.values,
        })
      : Result.failure(PublishSecurityConfigurationErrors.versionConflict);
  }
}
