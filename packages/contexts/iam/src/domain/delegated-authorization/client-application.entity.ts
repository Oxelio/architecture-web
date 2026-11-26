import { Result } from "@architecture/foundation";
import { v7 as uuid } from "uuid";

export interface ResourcePermission {
  readonly code: string;
  readonly description: string;
}

export interface ProtectedResource {
  readonly id: string;
  readonly uri: string;
  readonly permissions: readonly ResourcePermission[];
}

export interface ClientResourcePolicy {
  readonly resourceId: string;
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

export interface ClientApplicationState {
  readonly id: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly redirectUris: readonly string[];
  readonly enabled: boolean;
  readonly revision: number;
  readonly policies: readonly ClientResourcePolicy[];
}

export class ClientApplication {
  private constructor(readonly state: ClientApplicationState) {}

  static register(
    publicId: string,
    displayName: string,
  ): Result<
    ClientApplication,
    { readonly code: "delegated_authorization.invalid_client" }
  > {
    if (!publicId.trim() || !displayName.trim()) {
      return Result.failure({
        code: "delegated_authorization.invalid_client",
      } as const);
    }
    return Result.success(
      new ClientApplication({
        id: uuid(),
        publicId,
        displayName,
        redirectUris: [],
        enabled: false,
        revision: 0,
        policies: [],
      }),
    );
  }

  static rehydrate(state: ClientApplicationState): ClientApplication {
    return new ClientApplication(state);
  }

  policyFor(resource: ProtectedResource): ClientResourcePolicy | undefined {
    const policy = this.state.policies.find(
      (candidate) => candidate.resourceId === resource.id,
    );
    if (!policy) {
      return undefined;
    }
    const codes = [...policy.required, ...policy.optional];
    const recognized = new Set(resource.permissions.map(({ code }) => code));
    if (
      !codes.length ||
      new Set(codes).size !== codes.length ||
      codes.some((code) => !recognized.has(code))
    ) {
      return undefined;
    }
    return policy;
  }
}
