import type { Result, ValueOf } from "@architecture/foundation";

import type { PublishSecurityConfigurationError } from "#access-administration/publish-security-configuration/publish-security-configuration.contracts";

export const RestoreSecurityConfigurationErrors = {
  revisionNotFound: { code: "security_configuration.revision_not_found" },
} as const;

export interface RestoreSecurityConfigurationInput {
  actorId: string;
  revisionId: string;
  expectedVersion: number;
  justification: string;
  confirmedCritical: boolean;
  sessionId?: string;
  password?: string;
  mfaCode?: string;
}

export type RestoreSecurityConfigurationError =
  | ValueOf<typeof RestoreSecurityConfigurationErrors>
  | PublishSecurityConfigurationError;

export type RestoreSecurityConfigurationOutput = Result<
  {
    id: string;
    version: number;
    effective: import("#domain/security-policy").SecurityPolicy;
  },
  RestoreSecurityConfigurationError
>;

export interface RestoreSecurityConfiguration {
  execute(
    input: RestoreSecurityConfigurationInput,
  ): Promise<RestoreSecurityConfigurationOutput>;
}
