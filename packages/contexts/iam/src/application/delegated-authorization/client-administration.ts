import { Result } from "@architecture/foundation";

import type { CriticalConfigurationSecurityState } from "#access-administration/security-configuration/critical-configuration-confirmation.store";
import type {
  FactorVerification,
  Reauthentication,
} from "#authentication/reauthentication";
import {
  ClientApplication,
  type ClientApplicationState,
  type ClientResourcePolicy,
  type ProtectedResource,
} from "#domain/delegated-authorization/client-application.entity";
import type { SessionRepository } from "#ports/session.repository";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

export type ClientChangeKind =
  | "registered"
  | "activated"
  | "disabled"
  | "metadata_changed"
  | "policy_changed";
export type ClientAdministrationError =
  | "forbidden"
  | "session_invalid"
  | "confirmation_refused"
  | "attempts_exhausted"
  | "revision_conflict"
  | "client_not_found"
  | "public_id_conflict"
  | "invalid_client";

interface AdminFailure {
  readonly code: ClientAdministrationError;
}
type ClientResult = Result<ClientApplicationState, AdminFailure>;
type ClientPlan = Result<
  { client: ClientApplication; kind?: ClientChangeKind; critical: boolean },
  AdminFailure
>;

interface Actor {
  readonly accountId: string;
  readonly sessionId: string;
}

export type ClientCommand =
  | { readonly kind: "rename"; readonly displayName: string }
  | {
      readonly kind: "configure";
      readonly redirectUris: readonly string[];
      readonly policies: readonly ClientResourcePolicy[];
    }
  | { readonly kind: "enable" }
  | { readonly kind: "disable" };

interface ClientConfirmation {
  readonly password: string;
  readonly mfaCode?: string;
}

export interface ClientAdministrationTransaction {
  adminSessionVersion(): Promise<number | undefined>;
  security(): Promise<
    | (CriticalConfigurationSecurityState & { readonly mfaRequired: boolean })
    | undefined
  >;
  reserveAttempt(): Promise<boolean>;
  clients(): Promise<readonly ClientApplicationState[]>;
  client(id: string): Promise<ClientApplication | undefined>;
  publicIdExists(publicId: string): Promise<boolean>;
  save(client: ClientApplication, change: ClientChangeKind): Promise<void>;
}

export interface ClientAdministrationStore {
  run<T>(
    input: {
      readonly actorId: string;
      readonly affectedClientId?: string | undefined;
      readonly deadline: number;
    },
    run: (transaction: ClientAdministrationTransaction) => Promise<T>,
  ): Promise<T>;
}

const proofLifetime = 120_000;
const transactionBudget = 6_000;
const forbidden = () => Result.failure({ code: "forbidden" } as const);
const sessionInvalid = () =>
  Result.failure({ code: "session_invalid" } as const);
const refused = () => Result.failure({ code: "confirmation_refused" } as const);

function comparePolicyValues(left: string, right: string) {
  const alphabetical = left.localeCompare(right, "en");
  if (alphabetical || left === right) {
    return alphabetical;
  }
  // Collation can give distinct exact URI or permission strings the same rank.
  return left < right ? -1 : 1;
}

function orderedPolicies(policies: readonly ClientResourcePolicy[]) {
  return policies
    .map(({ resourceId, required, optional }) => ({
      resourceId,
      required: required.toSorted(comparePolicyValues),
      optional: optional.toSorted(comparePolicyValues),
    }))
    .sort((left, right) =>
      comparePolicyValues(left.resourceId, right.resourceId),
    );
}

export class ClientAdministration {
  private readonly catalog: ReadonlyMap<string, ProtectedResource>;

  constructor(
    private readonly store: ClientAdministrationStore,
    resources: readonly ProtectedResource[],
    private readonly sessions: Pick<SessionRepository, "findById">,
    private readonly reauthentication: Pick<Reauthentication, "password">,
    private readonly factor: Pick<FactorVerification, "verify">,
    private readonly now = () => performance.now(),
  ) {
    this.catalog = new Map(
      resources.map((resource) => [resource.id, resource]),
    );
  }

  async list(actor: Actor): Promise<
    Result<
      {
        readonly clients: readonly ClientApplicationState[];
        readonly resources: readonly ProtectedResource[];
      },
      AdminFailure
    >
  > {
    return this.store.run(
      { actorId: actor.accountId, deadline: this.now() + transactionBudget },
      async (tx) => {
        const version = await tx.adminSessionVersion();
        if (version === undefined) {
          return forbidden();
        }
        if (!(await this.sessionIsCurrent(actor, version))) {
          return sessionInvalid();
        }
        return Result.success({
          clients: await tx.clients(),
          resources: [...this.catalog.values()],
        });
      },
    );
  }

  async register(
    actor: Actor,
    input: { readonly publicId: string; readonly displayName: string },
  ): Promise<ClientResult> {
    const publicId = input.publicId.trim();
    const displayName = input.displayName.trim();
    if (
      !/^[A-Za-z0-9._~-]{1,128}$/u.test(publicId) ||
      !displayName ||
      displayName.length > 160
    ) {
      return Result.failure({ code: "invalid_client" });
    }
    const client = ClientApplication.register(publicId, displayName);
    if (!client.success) {
      return Result.failure({ code: "invalid_client" });
    }
    return this.store.run(
      { actorId: actor.accountId, deadline: this.now() + transactionBudget },
      async (tx) => {
        const version = await tx.adminSessionVersion();
        if (version === undefined) {
          return forbidden();
        }
        if (!(await this.sessionIsCurrent(actor, version))) {
          return sessionInvalid();
        }
        if (await tx.publicIdExists(publicId)) {
          return Result.failure({ code: "public_id_conflict" });
        }
        await tx.save(client.value, "registered");
        return Result.success(client.value.state);
      },
    );
  }

  async change(input: {
    readonly actor: Actor;
    readonly clientId: string;
    readonly expectedRevision: number;
    readonly command: ClientCommand;
    readonly confirmation?: ClientConfirmation | undefined;
    readonly startedAt?: number | undefined;
  }): Promise<ClientResult> {
    // The request-local authorization is used only by this normalized command.
    const { actor, clientId, expectedRevision, command, confirmation } =
      structuredClone(input);
    const proofDeadline = (input.startedAt ?? this.now()) + proofLifetime;
    if (this.now() >= proofDeadline) {
      return refused();
    }
    const normalizedFactor = confirmation?.mfaCode?.replace(/[\s-]/gu, "");
    const admitted = await this.store.run(
      {
        actorId: actor.accountId,
        deadline: Math.min(proofDeadline, this.now() + transactionBudget),
      },
      async (tx) => {
        const version = await tx.adminSessionVersion();
        if (version === undefined) {
          return forbidden();
        }
        if (!(await this.sessionIsCurrent(actor, version, proofDeadline))) {
          return sessionInvalid();
        }
        const updated = await this.plan(
          tx,
          clientId,
          expectedRevision,
          command,
        );
        if (!updated.success) {
          return updated;
        }
        const { client, kind, critical } = updated.value;
        if (!critical) {
          if (kind) {
            await tx.save(client, kind);
          }
          return Result.success({ client: client.state });
        }
        if (
          !confirmation ||
          !PasswordPlainValueObject.create(confirmation.password).success
        ) {
          return refused();
        }
        const security = await tx.security();
        if (
          !security ||
          this.now() >= proofDeadline ||
          (security.mfaEnabled && !normalizedFactor) ||
          (!security.mfaEnabled && security.mfaRequired)
        ) {
          return refused();
        }
        return (await tx.reserveAttempt())
          ? Result.success({ proof: security })
          : Result.failure({ code: "attempts_exhausted" } as const);
      },
    );
    if (!admitted.success) {
      return admitted;
    }
    if ("client" in admitted.value) {
      return Result.success(admitted.value.client);
    }
    const security = admitted.value.proof;
    if (
      !security ||
      !confirmation ||
      this.now() >= proofDeadline ||
      !(
        await this.reauthentication.password(
          actor.accountId,
          confirmation.password,
        )
      ).success ||
      this.now() >= proofDeadline
    ) {
      return refused();
    }
    if (
      security.mfaEnabled &&
      !(await this.factor.verify(actor.accountId, normalizedFactor ?? ""))
        .success
    ) {
      return refused();
    }
    if (this.now() >= proofDeadline) {
      return refused();
    }
    return this.store.run(
      {
        actorId: actor.accountId,
        affectedClientId: clientId,
        deadline: Math.min(proofDeadline, this.now() + transactionBudget),
      },
      async (tx) => {
        const version = await tx.adminSessionVersion();
        if (version === undefined) {
          return forbidden();
        }
        if (version !== security.sessionVersion) {
          return sessionInvalid();
        }
        const current = await tx.security();
        if (
          current?.comparison !== security.comparison ||
          this.now() >= proofDeadline
        ) {
          return refused();
        }
        const planned = await this.plan(
          tx,
          clientId,
          expectedRevision,
          command,
        );
        if (!planned.success) {
          return planned;
        }
        const { client, kind } = planned.value;
        if (!(await this.sessionIsCurrent(actor, version, proofDeadline))) {
          return sessionInvalid();
        }
        if (this.now() >= proofDeadline) {
          return refused();
        }
        if (kind) {
          await tx.save(client, kind);
        }
        return Result.success(client.state);
      },
    );
  }

  private async plan(
    tx: ClientAdministrationTransaction,
    id: string,
    expectedRevision: number,
    command: ClientCommand,
  ): Promise<ClientPlan> {
    const client = await tx.client(id);
    if (!client) {
      return Result.failure({ code: "client_not_found" });
    }
    if (client.state.revision !== expectedRevision) {
      return Result.failure({ code: "revision_conflict" });
    }
    const next = { ...client.state, revision: expectedRevision + 1 };
    if (command.kind === "rename") {
      const displayName = command.displayName.trim();
      if (!displayName || displayName.length > 160) {
        return Result.failure({ code: "invalid_client" });
      }
      return Result.success(
        displayName === next.displayName
          ? { client, critical: false }
          : {
              client: ClientApplication.rehydrate({ ...next, displayName }),
              kind: "metadata_changed",
              critical: false,
            },
      );
    }
    if (command.kind === "configure") {
      return this.planConfiguration(client, next, command);
    }
    const enabled = command.kind === "enable";
    const changed = ClientApplication.rehydrate({ ...next, enabled });
    if (enabled && !this.validConfiguration(changed)) {
      return Result.failure({ code: "invalid_client" });
    }
    return Result.success(
      enabled === next.enabled
        ? { client, critical: false }
        : {
            client: changed,
            kind: enabled ? "activated" : "disabled",
            critical: true,
          },
    );
  }

  private planConfiguration(
    client: ClientApplication,
    next: ClientApplicationState,
    command: Extract<ClientCommand, { kind: "configure" }>,
  ): ClientPlan {
    const redirectUris = command.redirectUris.toSorted(comparePolicyValues);
    const policies = orderedPolicies(command.policies);
    const configured = ClientApplication.rehydrate({
      ...next,
      redirectUris,
      policies,
    });
    if (!this.validConfiguration(configured)) {
      return Result.failure({ code: "invalid_client" });
    }
    const policyChanged =
      JSON.stringify(orderedPolicies(client.state.policies)) !==
      JSON.stringify(policies);
    const redirectChanged =
      JSON.stringify(
        client.state.redirectUris.toSorted(comparePolicyValues),
      ) !== JSON.stringify(redirectUris);
    if (!policyChanged && !redirectChanged) {
      return Result.success({ client, critical: false });
    }
    return Result.success({
      client: configured,
      kind: policyChanged ? "policy_changed" : "metadata_changed",
      critical: true,
    });
  }

  private validConfiguration(client: ClientApplication) {
    const { redirectUris, policies, enabled } = client.state;
    return (
      (!enabled || (redirectUris.length > 0 && policies.length > 0)) &&
      new Set(redirectUris).size === redirectUris.length &&
      redirectUris.every((value) => {
        try {
          const uri = new URL(value);
          return (
            uri.protocol === "https:" &&
            !uri.username &&
            !uri.password &&
            !value.includes("#") &&
            value.trim() === value
          );
        } catch {
          return false;
        }
      }) &&
      new Set(policies.map(({ resourceId }) => resourceId)).size ===
        policies.length &&
      policies.every(({ resourceId }) => {
        const resource = this.catalog.get(resourceId);
        return Boolean(resource && client.policyFor(resource));
      })
    );
  }

  private async sessionIsCurrent(
    actor: Actor,
    version: number,
    deadline = this.now() + transactionBudget,
  ) {
    const remaining = Math.min(2_000, deadline - this.now());
    const sid = SessionIdentifierValueObject.create(actor.sessionId);
    if (remaining <= 0 || !sid.success) {
      return false;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const session = await Promise.race([
        this.sessions.findById(sid.value),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error("Client administration session read timed out")),
            remaining,
          );
        }),
      ]);
      return Boolean(
        session &&
        this.now() < deadline &&
        !session.isExpired() &&
        session.userId.value === actor.accountId &&
        session.userSessionVersion === version,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
