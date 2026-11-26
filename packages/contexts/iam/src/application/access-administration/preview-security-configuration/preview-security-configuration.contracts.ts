import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";
import type { SecurityPolicyError } from "#domain/security-policy";

export type PreviewSecurityConfigurationInput = { actorId: string } & (
  { values: unknown } | { revisionId: string }
);

export type PreviewSecurityConfigurationError =
  | AdministratorAuthorizationError
  | SecurityPolicyError
  | { code: "security_configuration.revision_not_found" };

export type PreviewSecurityConfigurationOutput = Result<
  {
    valid: boolean;
    expectedVersion: number;
    changedKeys: string[];
    affectedAccounts: { administratorsRequiringEnrollment: number };
    impact: "critical" | "standard";
    changes: { key: string; before: unknown; after: unknown }[];
    warnings: string[];
  },
  PreviewSecurityConfigurationError
>;

export interface PreviewSecurityConfiguration {
  execute(
    input: PreviewSecurityConfigurationInput,
  ): Promise<PreviewSecurityConfigurationOutput>;
}
