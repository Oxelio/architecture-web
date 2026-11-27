import { randomUUID } from "node:crypto";

import type {
  DelegatedAuthorizationReader,
  DelegatedAuthorizationStore,
  DelegatedAuthorizationWriter,
} from "@architecture/iam/application";
import {
  type ClientAdministrationStore,
  type ClientAdministrationTransaction,
  createDelegatedApprovalFact,
  createDelegatedClientChangeFact,
  createDelegatedRevocationFact,
  createDelegatedWithdrawalFact,
} from "@architecture/iam/application";
import {
  AuthorizationGrant,
  type AuthorizationTarget,
  ClientApplication,
  type ClientResourcePolicy,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, type Selectable, sql, type Transaction } from "kysely";

import type { IamDatabase, IamDelegatedGrantTable } from "#persistence/schema";

import {
  currentAccessPolicy,
  lockAdministrativeAccess,
} from "./administrative-access.js";
import {
  appendDelegatedFacts,
  invalidateDelegatedAccount,
  invalidateDelegatedClient,
  lockDelegatedClientAccounts,
} from "./delegated-revocation.js";
import {
  readCriticalSecurityState,
  reserveCriticalConfirmation,
} from "./kysely-critical-configuration-confirmation.adapter.js";

function toGrant(row: Selectable<IamDelegatedGrantTable>) {
  return AuthorizationGrant.rehydrate({
    id: row.id,
    accountId: row.account_id,
    clientId: row.client_id,
    resourceId: row.resource_id,
    authorizedAt: row.authorized_at,
    revokedAt: row.revoked_at,
    permissions: row.permissions,
  });
}

function toClient(row: Selectable<IamDatabase["iam_delegated_clients"]>) {
  return ClientApplication.rehydrate({
    id: row.id,
    publicId: row.public_id,
    displayName: row.display_name,
    redirectUris: row.redirect_uris,
    enabled: row.enabled,
    revision: row.revision,
    policies: row.policies,
  });
}

function samePermissions(
  previous: readonly string[],
  current: readonly string[],
) {
  const permissions = new Set(previous);
  return (
    previous.length === current.length &&
    permissions.size === previous.length &&
    new Set(current).size === current.length &&
    current.every((permission) => permissions.has(permission))
  );
}

function samePolicy(
  previous: readonly ClientResourcePolicy[],
  current: readonly ClientResourcePolicy[],
) {
  const byResource = new Map(
    previous.map((policy) => [policy.resourceId, policy]),
  );
  return (
    byResource.size === previous.length &&
    previous.length === current.length &&
    current.every((policy) => {
      const old = byResource.get(policy.resourceId);
      return (
        old !== undefined &&
        samePermissions(old.required, policy.required) &&
        samePermissions(old.optional, policy.optional)
      );
    })
  );
}

class KyselyDelegatedAuthorizationTransaction implements DelegatedAuthorizationWriter {
  constructor(
    private readonly db: Transaction<IamDatabase>,
    private readonly outbox?: OutboxWriter,
    private readonly accountId?: string | null,
    private readonly lockedClientId?: string,
  ) {}

  async eligibleAccount(accountId: string) {
    const row = await this.db
      .selectFrom("iam_users")
      .select("status")
      .where("id", "=", accountId)
      .executeTakeFirst();
    return row?.status === "active";
  }

  async client(clientId: string) {
    const row = await this.db
      .selectFrom("iam_delegated_clients")
      .selectAll()
      .where("id", "=", clientId)
      .executeTakeFirst();
    return row && toClient(row);
  }

  async grant(accountId: string, grantId: string) {
    const row = await this.db
      .selectFrom("iam_delegated_grants")
      .selectAll()
      .where("id", "=", grantId)
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    return row && toGrant(row);
  }

  async activeGrant(target: AuthorizationTarget) {
    const row = await this.db
      .selectFrom("iam_delegated_grants")
      .selectAll()
      .where("account_id", "=", target.accountId)
      .where("client_id", "=", target.clientId)
      .where("resource_id", "=", target.resourceId)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    return row && toGrant(row);
  }

  async grants(accountId: string) {
    const rows = await this.db
      .selectFrom("iam_delegated_grants")
      .selectAll()
      .where("account_id", "=", accountId)
      .orderBy("id", "desc")
      .execute();
    return rows.map(toGrant);
  }

  async freshness(target: AuthorizationTarget) {
    const account = await this.db
      .selectFrom("iam_delegated_account_epochs")
      .select("epoch")
      .where("account_id", "=", target.accountId)
      .executeTakeFirst();
    const tuple = await this.db
      .selectFrom("iam_delegated_tuple_epochs")
      .select("epoch")
      .where("account_id", "=", target.accountId)
      .where("client_id", "=", target.clientId)
      .where("resource_id", "=", target.resourceId)
      .executeTakeFirst();
    return {
      accountEpoch: account?.epoch ?? "0",
      tupleEpoch: tuple?.epoch ?? "0",
    };
  }

  async saveClient({ state }: ClientApplication, administratorId: string) {
    if (this.accountId !== null) {
      throw new Error("Client policy requires a client-wide transaction");
    }
    if (
      new Set(state.policies.map(({ resourceId }) => resourceId)).size !==
      state.policies.length
    ) {
      throw new Error("A client must have one policy per resource");
    }
    const client = {
      id: state.id,
      public_id: state.publicId,
      display_name: state.displayName,
      redirect_uris: state.redirectUris,
      enabled: state.enabled,
      revision: state.revision,
      policies: JSON.stringify(state.policies),
    };
    if (client.revision === 0) {
      await this.db
        .insertInto("iam_delegated_clients")
        .values(client)
        .execute();
      return;
    }
    const previous = await this.client(client.id);
    if (previous?.state.revision !== client.revision - 1) {
      throw new Error("Unexpected delegated client revision");
    }
    const affectsAuthority =
      previous.state.enabled &&
      (!client.enabled || !samePolicy(previous.state.policies, state.policies));
    if (affectsAuthority && this.lockedClientId !== client.id) {
      await lockDelegatedClientAccounts(this.db, client.id);
    }
    const updated = await this.db
      .updateTable("iam_delegated_clients")
      .set({
        display_name: client.display_name,
        redirect_uris: client.redirect_uris,
        enabled: client.enabled,
        revision: client.revision,
        policies: client.policies,
      })
      .where("id", "=", client.id)
      .where("revision", "=", client.revision - 1)
      .executeTakeFirst();
    if (updated.numUpdatedRows !== 1n) {
      throw new Error("Unexpected delegated client revision");
    }
    if (affectsAuthority) {
      await invalidateDelegatedClient(
        this.db,
        this.outbox,
        state,
        administratorId,
      );
    }
  }

  async saveGrant(
    { state }: AuthorizationGrant,
    approval?: {
      readonly created: boolean;
      readonly addedPermissions: readonly string[];
    },
  ) {
    if (this.accountId !== state.accountId) {
      throw new Error("Grant mutation requires the locked account");
    }
    const permissions = JSON.stringify(state.permissions);
    const persisted = await this.db
      .insertInto("iam_delegated_grants")
      .values({
        id: state.id,
        account_id: state.accountId,
        client_id: state.clientId,
        resource_id: state.resourceId,
        authorized_at: state.authorizedAt,
        revoked_at: state.revokedAt,
        permissions,
      })
      .onConflict((conflict) =>
        conflict
          .column("id")
          .doUpdateSet({
            revoked_at: state.revokedAt,
            permissions,
          })
          .where("iam_delegated_grants.revoked_at", "is", null)
          .where("iam_delegated_grants.account_id", "=", state.accountId)
          .where("iam_delegated_grants.client_id", "=", state.clientId)
          .where("iam_delegated_grants.resource_id", "=", state.resourceId),
      )
      .returning("id")
      .executeTakeFirst();
    if (!persisted) {
      throw new Error(
        "Cannot update a different or revoked authorization lifecycle",
      );
    }
    if (approval) {
      await appendDelegatedFacts(this.outbox, [
        createDelegatedApprovalFact({
          operationId: randomUUID(),
          userId: state.accountId,
          grantId: state.id,
          clientId: state.clientId,
          resourceId: state.resourceId,
          occurredAt: new Date(),
          approval,
        }),
      ]);
    }
  }

  async invalidateConsent(target: AuthorizationTarget) {
    if (this.accountId !== target.accountId) {
      throw new Error("Consent invalidation requires the locked account");
    }
    await this.db
      .insertInto("iam_delegated_tuple_epochs")
      .values({
        account_id: target.accountId,
        client_id: target.clientId,
        resource_id: target.resourceId,
        epoch: "1",
      })
      .onConflict((conflict) =>
        conflict
          .columns(["account_id", "client_id", "resource_id"])
          .doUpdateSet({
            epoch: sql<string>`iam_delegated_tuple_epochs.epoch + 1`,
          }),
      )
      .execute();
  }

  async saveGrantRestriction(
    grant: AuthorizationGrant,
    effect: "revocation" | { readonly permission: string },
  ) {
    const {
      accountId,
      clientId,
      resourceId,
      id: grantId,
      revokedAt,
    } = grant.state;
    if (!revokedAt && effect === "revocation") {
      throw new Error("A revoked grant is required to record revocation");
    }
    const context = {
      userId: accountId,
      clientId,
      resourceId,
      grantId,
      operationId: randomUUID(),
      occurredAt: revokedAt ?? new Date(),
      actor: { actorType: "user", actorId: accountId } as const,
    };
    const fact = revokedAt
      ? createDelegatedRevocationFact({
          ...context,
          affectedGrantCount: 1,
          reason:
            effect === "revocation"
              ? "user_revocation"
              : "required_permission_withdrawn",
        })
      : createDelegatedWithdrawalFact({
          ...context,
          permissions: effect === "revocation" ? [] : [effect.permission],
        });
    await this.saveGrant(grant);
    await this.invalidateConsent(grant.state);
    await appendDelegatedFacts(this.outbox, [fact]);
  }

  revokeAccountGrants(accountId: string): Promise<void> {
    if (this.accountId !== accountId) {
      throw new Error("Grant revocation requires the locked account");
    }
    return invalidateDelegatedAccount(this.db, this.outbox, {
      accountId,
      reason: "user_revocation",
      actor: { actorType: "user", actorId: accountId },
    });
  }
}

export class KyselyDelegatedAuthorizationAdapter
  implements DelegatedAuthorizationStore, ClientAdministrationStore
{
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly createOutbox?: (
      transaction: Kysely<IamDatabase>,
    ) => OutboxWriter,
  ) {}

  run<T>(
    {
      actorId,
      affectedClientId,
      deadline,
    }: Parameters<ClientAdministrationStore["run"]>[0],
    execute: (transaction: ClientAdministrationTransaction) => Promise<T>,
  ) {
    return this.boundedTransaction("exclusive", deadline, async (db) => {
      if (affectedClientId) {
        await lockDelegatedClientAccounts(db, affectedClientId, actorId);
      } else {
        await db
          .selectFrom("iam_users")
          .select("id")
          .where("id", "=", actorId)
          .forUpdate()
          .execute();
      }
      const outbox = this.createOutbox?.(db);
      const writer = new KyselyDelegatedAuthorizationTransaction(
        db,
        outbox,
        null,
        affectedClientId,
      );
      return execute({
        async adminSessionVersion() {
          const actor = await db
            .selectFrom("iam_users")
            .select("session_version")
            .where("id", "=", actorId)
            .where("status", "=", "active")
            .where("role", "=", "admin")
            .executeTakeFirst();
          return actor?.session_version;
        },
        async security() {
          const snapshot = await readCriticalSecurityState(db, actorId);
          if (!snapshot.success) {
            return;
          }
          const mfaRequired = (
            await currentAccessPolicy(db)
          ).authentication.mfaRequiredRoles.includes("admin");
          return {
            ...snapshot.value,
            comparison: `${snapshot.value.comparison}:${mfaRequired}`,
            mfaRequired,
          };
        },
        reserveAttempt: () =>
          reserveCriticalConfirmation(
            db,
            "iam_critical_client_attempts",
            actorId,
          ),
        async clients() {
          const rows = await db
            .selectFrom("iam_delegated_clients")
            .selectAll()
            .orderBy("display_name")
            .orderBy("id")
            .execute();
          return rows.map((row) => toClient(row).state);
        },
        client: (id) => writer.client(id),
        async publicIdExists(publicId) {
          return Boolean(
            await db
              .selectFrom("iam_delegated_clients")
              .select("id")
              .where("public_id", "=", publicId)
              .executeTakeFirst(),
          );
        },
        async save(client, kind) {
          await writer.saveClient(client, actorId);
          await appendDelegatedFacts(outbox, [
            createDelegatedClientChangeFact({
              administratorId: actorId,
              clientId: client.state.id,
              revision: client.state.revision,
              kind,
              operationId: randomUUID(),
              occurredAt: new Date(),
            }),
          ]);
        },
      });
    });
  }

  read<T>(
    run: (reader: DelegatedAuthorizationReader) => Promise<T>,
  ): Promise<T> {
    return this.db
      .transaction()
      .setIsolationLevel("read committed")
      .setAccessMode("read only")
      .execute(async (transaction) => {
        await lockAdministrativeAccess(transaction, "shared");
        return run(new KyselyDelegatedAuthorizationTransaction(transaction));
      });
  }

  write<T>(
    accountId: string | null,
    run: (writer: DelegatedAuthorizationWriter) => Promise<T>,
  ): Promise<T> {
    return this.db
      .transaction()
      .setIsolationLevel("read committed")
      .execute(async (transaction) => {
        await lockAdministrativeAccess(transaction);
        return run(await this.bindWriter(transaction, accountId));
      });
  }

  /** The protocol boundary already holds the administrative fence on this connection. */
  async bindWriter(
    transaction: Transaction<IamDatabase>,
    accountId: string | null,
  ) {
    if (accountId !== null) {
      await transaction
        .selectFrom("iam_users")
        .select("id")
        .where("id", "=", accountId)
        .forUpdate()
        .executeTakeFirst();
    }
    return new KyselyDelegatedAuthorizationTransaction(
      transaction,
      this.createOutbox?.(transaction),
      accountId,
    );
  }

  boundedTransaction<T>(
    mode: "exclusive" | "shared",
    deadline: number,
    run: (
      transaction: Transaction<IamDatabase>,
      reader: DelegatedAuthorizationReader,
    ) => Promise<T>,
  ) {
    return this.db
      .transaction()
      .setIsolationLevel("read committed")
      .setAccessMode(mode === "shared" ? "read only" : "read write")
      .execute(async (transaction) => {
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) {
          throw new Error("Delegated request deadline elapsed");
        }
        await sql`select set_config('lock_timeout', ${String(Math.min(500, remaining))}, true),
          set_config('statement_timeout', ${String(Math.min(2_000, remaining))}, true),
          set_config('transaction_timeout', ${String(Math.min(4_000, remaining))}, true)`.execute(
          transaction,
        );
        await lockAdministrativeAccess(transaction, mode);
        const result = await run(
          transaction,
          new KyselyDelegatedAuthorizationTransaction(transaction),
        );
        if (performance.now() >= deadline) {
          throw new Error("Delegated request deadline elapsed");
        }
        return result;
      });
  }
}
