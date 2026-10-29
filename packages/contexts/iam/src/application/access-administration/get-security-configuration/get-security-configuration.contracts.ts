import type { Result } from "@architecture/foundation";

import type { AdministratorAuthorizationError } from "#access-administration/administrator-authorizer";

export type GetSecurityConfigurationInput = string;

export type GetSecurityConfigurationError = AdministratorAuthorizationError;

export type GetSecurityConfigurationOutput = Result<
  {
    effective: import("#domain/security-policy").SecurityPolicy;
    effectiveRevision: { id: string; version: number };
    revisions: readonly import("#access-administration/security-configuration/configuration.store").ConfigurationRevisionMetadata[];
  },
  GetSecurityConfigurationError
>;

export interface GetSecurityConfiguration {
  execute(
    actorId: GetSecurityConfigurationInput,
  ): Promise<GetSecurityConfigurationOutput>;
}
