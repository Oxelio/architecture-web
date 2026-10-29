import type { Result, ValueOf } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";
import type { StrongAuthenticationError } from "#authentication/reauthentication.contracts";
import type { SecurityPolicyError } from "#domain/security-policy";

export const PublishSecurityConfigurationErrors = {
  justificationRequired: {
    code: "security_configuration.justification_required",
  },
  criticalConfirmationRequired: {
    code: "security_configuration.critical_confirmation_required",
  },
  recentProofRequired: { code: "authentication.recent_proof_required" },
  lastActiveAccess: { code: "administrator.last_active_access" },
  unauthorized: { code: "administrator.unauthorized" },
  versionConflict: { code: "security_configuration.version_conflict" },
} as const;

export interface PublishSecurityConfigurationInput {
  actorId: string;
  values: unknown;
  expectedVersion: number;
  justification: string;
  confirmedCritical: boolean;
  sessionId?: string;
  password?: string;
  mfaCode?: string;
  origin?: "administration" | "restoration";
  restoredFromRevisionId?: string;
}

export type PublishSecurityConfigurationError =
  | ValueOf<typeof PublishSecurityConfigurationErrors>
  | AdministratorAuthorizationError
  | SecurityPolicyError
  | StrongAuthenticationError;

export type PublishSecurityConfigurationOutput = Result<
  {
    id: string;
    version: number;
    effective: import("#domain/security-policy").SecurityPolicy;
  },
  PublishSecurityConfigurationError
>;

export interface PublishSecurityConfiguration {
  execute(
    input: PublishSecurityConfigurationInput,
  ): Promise<PublishSecurityConfigurationOutput>;
}
