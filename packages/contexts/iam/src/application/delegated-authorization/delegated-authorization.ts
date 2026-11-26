import { Result } from "@architecture/foundation";

import {
  AuthorizationGrant,
  type AuthorizationTarget,
} from "#domain/delegated-authorization/authorization-grant.entity";
import type { ProtectedResource } from "#domain/delegated-authorization/client-application.entity";

import {
  type ConnectedAuthorization,
  type ConsentError,
  type ConsentRequest,
  type DelegatedAdmissionInput,
  type DelegatedAuthorizationApplication,
  type DelegatedAuthorizationDependencies,
  DelegatedAuthorizationErrors as Errors,
  type DelegatedAuthorizationReader,
  type DelegatedAuthorizationWriter,
  type DelegatedCredentialAuthority,
  type FinalizeConsentInput,
  type PreparedConsent,
} from "./delegated-authorization.contracts.js";

export class DelegatedAuthorization {
  private readonly resources: ReadonlyMap<string, ProtectedResource>;

  constructor(resources: readonly ProtectedResource[]) {
    this.resources = new Map(
      resources.map((resource) => [resource.id, resource]),
    );
    if (
      this.resources.size !== resources.length ||
      new Set(resources.map(({ uri }) => uri)).size !== resources.length
    ) {
      throw new Error("Duplicate delegated authorization resource");
    }
  }

  async clientPolicy(
    reader: DelegatedAuthorizationReader,
    target: AuthorizationTarget,
  ) {
    const resource = this.resources.get(target.resourceId);
    const client = await reader.client(target.clientId);
    const policy = resource && client?.policyFor(resource);
    return resource && client && policy
      ? { resource, client, policy }
      : undefined;
  }

  async prepare(
    reader: DelegatedAuthorizationReader,
    request: ConsentRequest,
  ): Promise<Result<PreparedConsent, ConsentError>> {
    if (!(await reader.eligibleAccount(request.accountId))) {
      return Result.failure(Errors.ineligibleAccount);
    }
    const context = await this.clientPolicy(reader, request);
    if (!context?.client.state.enabled) {
      return Result.failure(Errors.ineligibleClient);
    }
    if (context.client.state.revision !== request.clientRevision) {
      return Result.failure(Errors.staleConsent);
    }
    const { resource, client, policy } = context;
    const allowed = [...policy.required, ...policy.optional];
    if (
      !request.requested.length ||
      request.requested.some((code) => !allowed.includes(code)) ||
      policy.required.some((code) => !request.requested.includes(code))
    ) {
      return Result.failure(Errors.invalidPermission);
    }
    const freshness = await reader.freshness(request);
    return Result.success({
      ...request,
      applicationName: client.state.displayName,
      resourceUri: resource.uri,
      required: resource.permissions.filter(({ code }) =>
        policy.required.includes(code),
      ),
      optional: resource.permissions.filter(
        ({ code }) =>
          policy.optional.includes(code) && request.requested.includes(code),
      ),
      freshness: { ...freshness, clientRevision: client.state.revision },
    });
  }

  async finalize(
    writer: DelegatedAuthorizationWriter,
    { consent, selected, expiresAt, sessionIsCurrent }: FinalizeConsentInput,
  ): Promise<Result<DelegatedCredentialAuthority, ConsentError>> {
    const current = await this.prepare(writer, consent);
    if (!current.success) {
      return current;
    }
    const { freshness, required, optional, resourceUri } = current.value;
    if (
      freshness.accountEpoch !== consent.freshness.accountEpoch ||
      freshness.tupleEpoch !== consent.freshness.tupleEpoch ||
      freshness.clientRevision !== consent.freshness.clientRevision ||
      resourceUri !== consent.resourceUri ||
      !(expiresAt.getTime() > Date.now()) ||
      !(await sessionIsCurrent(consent.accountId)) ||
      !(expiresAt.getTime() > Date.now())
    ) {
      return Result.failure(Errors.staleConsent);
    }

    const eligible = [...required, ...optional].map(({ code }) => code);
    if (
      !selected.length ||
      selected.some((code) => !eligible.includes(code)) ||
      required.some(({ code }) => !selected.includes(code))
    ) {
      return Result.failure(Errors.invalidPermission);
    }

    const previous = await writer.activeGrant(consent);
    const grant =
      previous?.extend(selected) ??
      AuthorizationGrant.authorize(consent, selected, new Date());
    if (grant !== previous) {
      await writer.saveGrant(grant);
    }
    return Result.success({
      accountId: consent.accountId,
      clientId: consent.clientId,
      resourceId: consent.resourceId,
      grantId: grant.state.id,
      entitlements: grant.state.permissions.filter(({ code }) =>
        selected.includes(code),
      ),
    });
  }

  /** Used under the caller's authoritative transaction for issuance, renewal and admission. */
  async currentEntitlements(
    reader: DelegatedAuthorizationReader,
    credential: DelegatedCredentialAuthority,
  ) {
    if (!(await reader.eligibleAccount(credential.accountId))) {
      return [];
    }
    const context = await this.clientPolicy(reader, credential);
    if (!context?.client.state.enabled) {
      return [];
    }
    const grant = await reader.grant(credential.accountId, credential.grantId);
    if (
      !grant ||
      grant.state.clientId !== credential.clientId ||
      grant.state.resourceId !== credential.resourceId
    ) {
      return [];
    }
    const allowed = [...context.policy.required, ...context.policy.optional];
    const current = grant.currentEntitlements(allowed, credential.entitlements);
    return context.policy.required.every((code) =>
      current.some((permission) => permission.code === code),
    )
      ? current
      : [];
  }

  async admit(
    reader: DelegatedAuthorizationReader,
    {
      credential,
      intendedResourceId,
      permission,
      scope,
    }: DelegatedAdmissionInput,
  ): Promise<
    Result<{ readonly accountId: string }, typeof Errors.accessDenied>
  > {
    if (
      credential.resourceId !== intendedResourceId ||
      !scope.includes(permission)
    ) {
      return Result.failure(Errors.accessDenied);
    }
    const current = await this.currentEntitlements(reader, credential);
    return current.some(({ code }) => code === permission)
      ? Result.success({ accountId: credential.accountId })
      : Result.failure(Errors.accessDenied);
  }
}

export function delegatedAuthorizationApplication({
  store,
  resources,
}: DelegatedAuthorizationDependencies): DelegatedAuthorizationApplication {
  const authority = new DelegatedAuthorization(resources);
  return {
    prepareConsent: {
      execute: (request) =>
        store.read((reader) => authority.prepare(reader, request)),
    },
    finalizeConsent: {
      execute: (input) =>
        store.write(input.consent.accountId, (writer) =>
          authority.finalize(writer, input),
        ),
    },
    listGrants: {
      execute: ({ accountId }) =>
        store.read(async (reader) => {
          if (!(await reader.eligibleAccount(accountId))) {
            return Result.failure(Errors.ineligibleAccount);
          }
          const projections: ConnectedAuthorization[] = [];
          for (const { state } of await reader.grants(accountId)) {
            const client = await reader.client(state.clientId);
            if (!client) {
              throw new Error("Authorization grant has no client");
            }
            projections.push({
              id: state.id,
              clientId: state.clientId,
              applicationName: client.state.displayName,
              resourceId: state.resourceId,
              permissions: state.permissions.map(({ code }) => code),
              authorizedAt: state.authorizedAt,
              revokedAt: state.revokedAt,
            });
          }
          return Result.success(projections);
        }),
    },
    revokeGrant: {
      execute: ({ accountId, grantId }) =>
        store.write(accountId, async (writer) => {
          const grant = await writer.grant(accountId, grantId);
          if (!grant) {
            return Result.failure(Errors.grantNotFound);
          }
          const revoked = grant.revoke(new Date());
          if (revoked === grant) {
            return Result.success(false);
          }
          await writer.saveGrant(revoked);
          await writer.invalidateConsent(grant.state);
          return Result.success(true);
        }),
    },
    withdrawPermission: {
      execute: ({ accountId, grantId, permission }) =>
        store.write(accountId, async (writer) => {
          const grant = await writer.grant(accountId, grantId);
          if (!grant) {
            return Result.failure(Errors.grantNotFound);
          }
          const context = await authority.clientPolicy(writer, grant.state);
          if (!context) {
            return Result.failure(Errors.ineligibleClient);
          }
          const restricted = grant.withdraw(
            permission,
            context.policy.required,
            new Date(),
          );
          if (restricted === grant) {
            return Result.success(false);
          }
          await writer.saveGrant(restricted);
          await writer.invalidateConsent(grant.state);
          return Result.success(true);
        }),
    },
    admit: {
      execute: (input) =>
        store.read((reader) => authority.admit(reader, input)),
    },
  };
}
