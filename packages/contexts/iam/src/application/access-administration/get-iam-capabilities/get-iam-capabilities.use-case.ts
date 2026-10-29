import { Result } from "@architecture/foundation";

import type { ConfigurationStore } from "#access-administration/security-configuration/configuration.store";

import type {
  GetIamCapabilities,
  GetIamCapabilitiesOutput,
} from "./get-iam-capabilities.contracts.js";

export class GetIamCapabilitiesUseCase implements GetIamCapabilities {
  constructor(
    private readonly published: Pick<ConfigurationStore, "readPublished">,
  ) {}
  async execute(): Promise<GetIamCapabilitiesOutput> {
    const {
      accounts: a,
      authentication,
      sessions,
      recovery,
    } = (await this.published.readPublished()).values;
    return Result.success({
      publicRegistration: a.publicRegistration,
      allowedLoginIdentifiers: a.allowedLoginIdentifiers,
      emailVerification: a.emailVerification,
      emailChange: a.emailChange,
      sessionManagement: sessions.userManagement,
      recovery: recovery.enabled,
      mfa: authentication.mfaAvailable,
      accountExport: a.export,
      accountDeletion: a.deletion,
    });
  }
}
