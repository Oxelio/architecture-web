import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";
import {
  changedPolicyKeys,
  CRITICAL_SECURITY_POLICY_KEYS,
  parseSecurityPolicy,
  policyValue,
} from "#domain/security-policy";

import type {
  PreviewSecurityConfiguration,
  PreviewSecurityConfigurationInput,
  PreviewSecurityConfigurationOutput,
} from "./preview-security-configuration.contracts.js";

export class PreviewSecurityConfigurationUseCase implements PreviewSecurityConfiguration {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
  ) {}
  async execute(
    input: PreviewSecurityConfigurationInput,
  ): Promise<PreviewSecurityConfigurationOutput> {
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
