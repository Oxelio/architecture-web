import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";
import type { SecurityPolicyError } from "#domain/security-policy";

export interface PreviewSecurityConfigurationInput {
  actorId: string;
  values: unknown;
}

export type PreviewSecurityConfigurationError =
  AdministratorAuthorizationError | SecurityPolicyError;

export type PreviewSecurityConfigurationOutput = Result<
  {
    valid: boolean;
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
