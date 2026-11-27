import type { Result, ValueOf } from "@architecture/foundation";

import type {
  AuthorizationGrant,
  AuthorizationTarget,
  PermissionGeneration,
} from "#domain/delegated-authorization/authorization-grant.entity";
import type {
  ClientApplication,
  ProtectedResource,
  ResourcePermission,
} from "#domain/delegated-authorization/client-application.entity";

export interface ConsentFreshness {
  readonly accountEpoch: string;
  readonly tupleEpoch: string;
  readonly clientRevision: number;
}

export interface DelegatedAuthorizationReader {
  eligibleAccount(accountId: string): Promise<boolean>;
  client(clientId: string): Promise<ClientApplication | undefined>;
  grant(
    accountId: string,
    grantId: string,
  ): Promise<AuthorizationGrant | undefined>;
  activeGrant(
    target: AuthorizationTarget,
  ): Promise<AuthorizationGrant | undefined>;
  grants(accountId: string): Promise<readonly AuthorizationGrant[]>;
  freshness(
    target: AuthorizationTarget,
  ): Promise<Omit<ConsentFreshness, "clientRevision">>;
}

export interface DelegatedAuthorizationWriter extends DelegatedAuthorizationReader {
  saveClient(client: ClientApplication, administratorId: string): Promise<void>;
  saveGrant(grant: AuthorizationGrant): Promise<void>;
  invalidateConsent(target: AuthorizationTarget): Promise<void>;
  saveGrantRestriction(
    grant: AuthorizationGrant,
    effect: "revocation" | { readonly permission: string },
  ): Promise<void>;
  revokeAccountGrants(accountId: string): Promise<void>;
}

export interface DelegatedAuthorizationStore {
  read<T>(
    run: (reader: DelegatedAuthorizationReader) => Promise<T>,
  ): Promise<T>;
  write<T>(
    accountId: string | null,
    run: (writer: DelegatedAuthorizationWriter) => Promise<T>,
  ): Promise<T>;
}

export interface ConsentRequest extends AuthorizationTarget {
  readonly requested: readonly string[];
  readonly clientRevision: number;
}

/** Restored by the trusted interaction adapter. The adapter binds it to its one-use decision and exact session. */
export interface PreparedConsent extends ConsentRequest {
  readonly freshness: ConsentFreshness;
  readonly applicationName: string;
  readonly resourceUri: string;
  readonly required: readonly ResourcePermission[];
  readonly optional: readonly ResourcePermission[];
}

export interface FinalizeConsentInput {
  readonly consent: PreparedConsent;
  readonly selected: readonly string[];
  readonly expiresAt: Date;
  // Consult the owning session store inside the authoritative transaction.
  readonly sessionIsCurrent: (accountId: string) => Promise<boolean>;
}

export interface DelegatedCredentialAuthority extends AuthorizationTarget {
  readonly grantId: string;
  readonly entitlements: readonly PermissionGeneration[];
}

export interface DelegatedAdmissionInput {
  readonly credential: DelegatedCredentialAuthority;
  readonly intendedResourceId: string;
  readonly permission: string;
  readonly scope: readonly string[];
}

export interface ConnectedAuthorization {
  readonly id: string;
  readonly clientId: string;
  readonly applicationName: string;
  readonly resourceId: string;
  readonly permissions: readonly string[];
  readonly authorizedAt: Date;
  readonly revokedAt: Date | null;
}

export const DelegatedAuthorizationErrors = {
  ineligibleAccount: { code: "delegated_authorization.ineligible_account" },
  ineligibleClient: { code: "delegated_authorization.ineligible_client" },
  invalidPermission: { code: "delegated_authorization.invalid_permission" },
  staleConsent: { code: "delegated_authorization.stale_consent" },
  grantNotFound: { code: "delegated_authorization.grant_not_found" },
  accessDenied: { code: "delegated_authorization.access_denied" },
} as const;

export type DelegatedAuthorizationError = ValueOf<
  typeof DelegatedAuthorizationErrors
>;

export interface DelegatedAuthorizationDependencies {
  readonly store: DelegatedAuthorizationStore;
  readonly resources: readonly ProtectedResource[];
}

interface Operation<Input, Value, Error extends DelegatedAuthorizationError> {
  execute(input: Input): Promise<Result<Value, Error>>;
}

type Errors = typeof DelegatedAuthorizationErrors;
export type ConsentError = Errors[
  | "ineligibleAccount"
  | "ineligibleClient"
  | "invalidPermission"
  | "staleConsent"];
interface GrantChange {
  readonly accountId: string;
  readonly grantId: string;
}

export interface DelegatedAuthorizationApplication {
  readonly prepareConsent: Operation<
    ConsentRequest,
    PreparedConsent,
    ConsentError
  >;
  readonly finalizeConsent: Operation<
    FinalizeConsentInput,
    DelegatedCredentialAuthority,
    ConsentError
  >;
  readonly listGrants: Operation<
    { readonly accountId: string },
    readonly ConnectedAuthorization[],
    Errors["ineligibleAccount"]
  >;
  readonly revokeGrant: Operation<
    GrantChange,
    boolean,
    Errors["grantNotFound"]
  >;
  readonly revokeAllGrants: Operation<
    { readonly accountId: string },
    void,
    Errors["ineligibleAccount"]
  >;
  readonly withdrawPermission: Operation<
    GrantChange & { readonly permission: string },
    boolean,
    Errors["grantNotFound" | "ineligibleClient"]
  >;
  readonly admit: Operation<
    DelegatedAdmissionInput,
    { readonly accountId: string },
    Errors["accessDenied"]
  >;
}
