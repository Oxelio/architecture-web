import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { IamResult } from "#application-result";
import { isSecurityOperationId } from "#domain/security-operation-id";
import {
  changedPolicyKeys,
  CRITICAL_SECURITY_POLICY_KEYS,
  parseSecurityPolicy,
  policyValue,
} from "#domain/security-policy";

import type { ConfigurationStore } from "./configuration.store.js";
export class GetSecurityConfigurationUseCase {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
  ) {}
  async execute(actorId: string): Promise<
    IamResult<{
      effective: import("#domain/security-policy").SecurityPolicy;
      effectiveRevision: { id: string; version: number };
      revisions: readonly import("./configuration.store.js").ConfigurationRevisionMetadata[];
    }>
  > {
    const authorized = await this.authorization.authorize(actorId);
    if (!authorized.success) {
      return authorized;
    }
    const published = await this.store.readPublished();
    return Result.success({
      effective: published.values,
      effectiveRevision: { id: published.id, version: published.version },
      revisions: await this.store.history(),
    });
  }
}
export class PreviewSecurityConfigurationUseCase {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
  ) {}
  async execute(input: { actorId: string; values: unknown }): Promise<
    IamResult<{
      valid: boolean;
      changedKeys: string[];
      affectedAccounts: { administratorsRequiringEnrollment: number };
      impact: "critical" | "standard";
      changes: { key: string; before: unknown; after: unknown }[];
      warnings: string[];
    }>
  > {
    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const parsed = parseSecurityPolicy(input.values);
    if (!parsed.success) {
      return parsed;
    }
    const effective = (await this.store.readPublished()).values,
      proposed = parsed.value;
    const changedKeys = changedPolicyKeys(effective, proposed);
    return Result.success({
      valid: true,
      changedKeys,
      impact: changedKeys.some((key) =>
        CRITICAL_SECURITY_POLICY_KEYS.includes(key),
      )
        ? "critical"
        : "standard",
      changes: changedKeys.map((key) => ({
        key,
        before: policyValue(effective, key),
        after: policyValue(proposed, key),
      })),
      warnings: [
        ...(effective.authentication.mfaAvailable &&
        !proposed.authentication.mfaAvailable
          ? [
              "Disabling MFA availability does not erase existing encrypted MFA settings.",
            ]
          : []),
        ...(proposed.audit.retentionDays < effective.audit.retentionDays
          ? ["The next maintenance run may purge older audit events."]
          : []),
      ],
      affectedAccounts: {
        administratorsRequiringEnrollment:
          proposed.authentication.mfaRequiredRoles.includes("admin") &&
          !effective.authentication.mfaRequiredRoles.includes("admin")
            ? await this.store.countAdministratorsWithoutMfa()
            : 0,
      },
    });
  }
}
export class PublishSecurityConfigurationUseCase {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
  ) {}
  async execute(input: {
    actorId: string;
    values: unknown;
    expectedVersion: number;
    justification: string;
    confirmedCritical: boolean;
  }): Promise<
    IamResult<{
      id: string;
      version: number;
      effective: import("#domain/security-policy").SecurityPolicy;
    }>
  > {
    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const parsed = parseSecurityPolicy(input.values);
    if (!parsed.success) {
      return parsed;
    }
    if (!input.justification.trim()) {
      return Result.failure({ code: "CONFIG_JUSTIFICATION_REQUIRED" } as const);
    }
    const previous = await this.store.readPublished();
    const changedKeys = changedPolicyKeys(previous.values, parsed.value);
    if (
      changedKeys.some((key) => CRITICAL_SECURITY_POLICY_KEYS.includes(key)) &&
      !input.confirmedCritical
    ) {
      return Result.failure({
        code: "CONFIG_CRITICAL_CONFIRMATION_REQUIRED",
      } as const);
    }
    const revision = await this.store.publish({
      actorId: input.actorId,
      values: parsed.value,
      expectedVersion: input.expectedVersion,
      justification: input.justification.trim().slice(0, 500),
      changedKeys,
    });
    return revision
      ? Result.success({
          id: revision.id,
          version: revision.version,
          effective: revision.values,
        })
      : Result.failure({ code: "CONFIG_VERSION_CONFLICT" } as const);
  }
}
export class RestoreSecurityConfigurationUseCase {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
    private readonly publish: PublishSecurityConfigurationUseCase,
  ) {}
  async execute(input: { actorId: string; revisionId: string }): Promise<
    IamResult<{
      id: string;
      version: number;
      effective: import("#domain/security-policy").SecurityPolicy;
    }>
  > {
    if (!isSecurityOperationId(input.revisionId)) {
      return Result.failure({ code: "CONFIG_REVISION_NOT_FOUND" } as const);
    }

    const authorized = await this.authorization.authorize(input.actorId);
    if (!authorized.success) {
      return authorized;
    }
    const target = await this.store.find(input.revisionId);
    if (!target) {
      return Result.failure({ code: "CONFIG_REVISION_NOT_FOUND" } as const);
    }
    const current = await this.store.readPublished();
    return this.publish.execute({
      actorId: input.actorId,
      values: target.values,
      expectedVersion: current.version,
      justification: `Restore ${input.revisionId}`,
      confirmedCritical: true,
    });
  }
}
export class GetIamCapabilitiesUseCase {
  constructor(
    private readonly published: Pick<ConfigurationStore, "readPublished">,
  ) {}
  async execute() {
    const {
      accounts: a,
      authentication,
      sessions,
      recovery,
    } = (await this.published.readPublished()).values;
    return {
      publicRegistration: a.publicRegistration,
      allowedLoginIdentifiers: a.allowedLoginIdentifiers,
      emailVerification: a.emailVerification,
      emailChange: a.emailChange,
      sessionManagement: sessions.userManagement,
      recovery: recovery.enabled,
      mfa: authentication.mfaAvailable,
      accountExport: a.export,
      accountDeletion: a.deletion,
    };
  }
}
