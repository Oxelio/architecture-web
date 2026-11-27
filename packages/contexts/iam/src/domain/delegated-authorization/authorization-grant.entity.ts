import { v7 as uuid } from "uuid";

export interface AuthorizationTarget {
  readonly accountId: string;
  readonly clientId: string;
  readonly resourceId: string;
}

export interface PermissionGeneration {
  readonly code: string;
  readonly generation: string;
}

export interface AuthorizationGrantState extends AuthorizationTarget {
  readonly id: string;
  readonly authorizedAt: Date;
  readonly revokedAt: Date | null;
  readonly permissions: readonly PermissionGeneration[];
}

export class AuthorizationGrant {
  private constructor(readonly state: AuthorizationGrantState) {}

  static authorize(
    target: AuthorizationTarget,
    selected: readonly string[],
    now: Date,
  ) {
    return new AuthorizationGrant({
      accountId: target.accountId,
      clientId: target.clientId,
      resourceId: target.resourceId,
      id: uuid(),
      authorizedAt: now,
      revokedAt: null,
      permissions: [],
    }).extend(selected);
  }

  static rehydrate(state: AuthorizationGrantState): AuthorizationGrant {
    return new AuthorizationGrant(state);
  }

  extend(selected: readonly string[]): AuthorizationGrant {
    const current = new Set(this.state.permissions.map(({ code }) => code));
    const additions = [...new Set(selected)].filter(
      (code) => !current.has(code),
    );
    if (this.state.revokedAt || !additions.length) {
      return this;
    }
    return new AuthorizationGrant({
      ...this.state,
      permissions: [
        ...this.state.permissions,
        ...additions.map((code) => ({ code, generation: uuid() })),
      ],
    });
  }

  withdraw(
    code: string,
    required: readonly string[],
    now: Date,
  ): AuthorizationGrant {
    const permissions = this.state.permissions.filter(
      (permission) => permission.code !== code,
    );
    if (
      this.state.revokedAt ||
      permissions.length === this.state.permissions.length
    ) {
      return this;
    }
    if (required.includes(code)) {
      return this.revoke(now);
    }
    return new AuthorizationGrant({ ...this.state, permissions });
  }

  revoke(now: Date): AuthorizationGrant {
    if (this.state.revokedAt) {
      return this;
    }
    return new AuthorizationGrant({ ...this.state, revokedAt: now });
  }

  currentEntitlements(
    allowed: readonly string[],
    issued: readonly PermissionGeneration[],
  ): readonly PermissionGeneration[] {
    if (this.state.revokedAt) {
      return [];
    }
    const generations = new Map(
      issued.map(({ code, generation }) => [code, generation]),
    );
    return this.state.permissions.filter(
      ({ code, generation }) =>
        allowed.includes(code) && generations.get(code) === generation,
    );
  }
}
