import type { Result } from "@architecture/foundation";

export type GetIamCapabilitiesError = never;

export type GetIamCapabilitiesOutput = Result<
  {
    publicRegistration: boolean;
    allowedLoginIdentifiers: readonly import("#value-objects/login-identifier.value-object").LoginIdentifierKind[];
    emailVerification: boolean;
    emailChange: boolean;
    sessionManagement: boolean;
    recovery: boolean;
    mfa: boolean;
    accountExport: boolean;
    accountDeletion: boolean;
  },
  GetIamCapabilitiesError
>;

export interface GetIamCapabilities {
  execute(): Promise<GetIamCapabilitiesOutput>;
}
