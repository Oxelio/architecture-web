import { Result } from "@architecture/foundation";

import type { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";

import type {
  GetSecurityConfiguration,
  GetSecurityConfigurationInput,
  GetSecurityConfigurationOutput,
} from "./get-security-configuration.contracts.js";

export class GetSecurityConfigurationUseCase implements GetSecurityConfiguration {
  constructor(
    private readonly authorization: AdministratorAuthorizer,
    private readonly store: ConfigurationStore,
  ) {}
  async execute(
    actorId: GetSecurityConfigurationInput,
  ): Promise<GetSecurityConfigurationOutput> {
    const authorized = await this.authorization.authorize(actorId);
    if (!authorized.success) {
      return authorized;
    }
    const { published, revisions } = await this.store.readCenter();
    return Result.success({
      effective: published.values,
      effectiveRevision: { id: published.id, version: published.version },
      revisions,
    });
  }
}
