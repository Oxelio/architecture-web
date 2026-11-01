import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { PublishSecurityConfiguration } from "#access-administration/publish-security-configuration/publish-security-configuration.contracts";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import { isSecurityOperationId } from "#domain/security-operation-id";

import {
  type RestoreSecurityConfiguration,
  RestoreSecurityConfigurationErrors,
  type RestoreSecurityConfigurationInput,
  type RestoreSecurityConfigurationOutput,
} from "./restore-security-configuration.contracts.js";

export class RestoreSecurityConfigurationUseCase implements RestoreSecurityConfiguration {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
    private readonly publish: PublishSecurityConfiguration,
    private readonly events: import("#accounts/security-effects").SecurityEventRecorder,
  ) {}
  async execute(
    input: RestoreSecurityConfigurationInput,
  ): Promise<RestoreSecurityConfigurationOutput> {
    const context = {
      actorType: "administrator" as const,
      actorId: input.actorId,
      subjectId: input.actorId,
    };
    const metadata = {
      expectedVersion: input.expectedVersion,
      origin: "restoration",
      justification: input.justification.trim().slice(0, 500),
      ...(isSecurityOperationId(input.revisionId)
        ? { restoredFromRevisionId: input.revisionId }
        : {}),
    };
    const result = await this.perform(input).catch(async (error_: unknown) => {
      const operationError = error_;
      try {
        await this.events.record(
          "security.config.restoration-attempt",
          "technical_failure",
          context,
          { ...metadata, result: "technical_failure" },
        );
      } catch (error_) {
        throw new AggregateError(
          [operationError, error_],
          "Configuration restoration and failure recording failed",
        );
      }
      throw operationError;
    });
    await this.events.record(
      "security.config.restoration-attempt",
      result.success ? "success" : "denied",
      context,
      { ...metadata, result: result.success ? "published" : result.error.code },
    );
    return result;
  }
  private async perform(
    input: RestoreSecurityConfigurationInput,
  ): Promise<RestoreSecurityConfigurationOutput> {
    if (!isSecurityOperationId(input.revisionId)) {
      return Result.failure(
        RestoreSecurityConfigurationErrors.revisionNotFound,
      );
    }

    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const target = await this.store.find(input.revisionId);
    if (!target) {
      return Result.failure(
        RestoreSecurityConfigurationErrors.revisionNotFound,
      );
    }
    return this.publish.execute({
      ...input,
      origin: "restoration",
      restoredFromRevisionId: input.revisionId,
      actorId: input.actorId,
      values: target.values,
      expectedVersion: input.expectedVersion,
      justification: input.justification,
      confirmedCritical: input.confirmedCritical,
    });
  }
}
