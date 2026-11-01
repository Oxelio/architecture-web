import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
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
    private readonly reauthentication: Pick<
      import("#authentication/reauthentication").Reauthentication,
      "strong"
    >,
    private readonly events: import("#accounts/security-effects").SecurityEventRecorder,
  ) {}
  async execute(
    input: PublishSecurityConfigurationInput,
  ): Promise<PublishSecurityConfigurationOutput> {
    const result = await this.perform(input).catch(async (error_: unknown) => {
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
    });
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
        justification: input.justification.trim().slice(0, 500),
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
  ): Promise<PublishSecurityConfigurationOutput> {
    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const parsed = parseSecurityPolicy(input.values);
    if (!parsed.success) {
      return parsed;
    }
    if (!input.justification.trim()) {
      return Result.failure(
        PublishSecurityConfigurationErrors.justificationRequired,
      );
    }
    const previous = await this.store.readPublished();
    const changedKeys = changedPolicyKeys(previous.values, parsed.value);
    if (
      changedKeys.some((key) => CRITICAL_SECURITY_POLICY_KEYS.includes(key)) &&
      !input.confirmedCritical
    ) {
      return Result.failure(
        PublishSecurityConfigurationErrors.criticalConfirmationRequired,
      );
    }
    let expectedActorSessionVersion: number | undefined;
    if (
      changedKeys.some((key) => CRITICAL_SECURITY_POLICY_KEYS.includes(key))
    ) {
      const proof = await this.reauthentication.strong(
        input.actorId,
        input.sessionId ?? "",
        input.password ?? "",
        input.mfaCode,
        previous.values.authentication,
      );
      if (!proof.success) {
        return proof;
      }
      expectedActorSessionVersion = proof.value;
    }
    const revision = await this.store.publish({
      actorId: input.actorId,
      values: parsed.value,
      expectedVersion: input.expectedVersion,
      justification: input.justification.trim().slice(0, 500),
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
      return Result.failure(
        PublishSecurityConfigurationErrors.recentProofRequired,
      );
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
