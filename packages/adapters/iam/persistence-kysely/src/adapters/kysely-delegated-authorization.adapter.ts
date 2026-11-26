import type {
  DelegatedAuthorizationReader,
  DelegatedAuthorizationStore,
  DelegatedAuthorizationWriter,
} from "@architecture/iam/application";
import {
  AuthorizationGrant,
  type AuthorizationTarget,
  ClientApplication,
} from "@architecture/iam/domain";
import { type Kysely, type Selectable, sql, type Transaction } from "kysely";

import type { IamDatabase, IamDelegatedGrantTable } from "#persistence/schema";

import { lockAdministrativeAccess } from "./administrative-access.js";

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

class KyselyDelegatedAuthorizationTransaction implements DelegatedAuthorizationWriter {
  constructor(private readonly db: Transaction<IamDatabase>) {}

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
    return (
      row &&
      ClientApplication.rehydrate({
        id: row.id,
        publicId: row.public_id,
        displayName: row.display_name,
        redirectUris: row.redirect_uris,
        enabled: row.enabled,
        revision: row.revision,
        policies: row.policies,
      })
    );
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

  async saveClient({ state }: ClientApplication) {
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
  }

  async saveGrant({ state }: AuthorizationGrant) {
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
  }

  async invalidateConsent(target: AuthorizationTarget) {
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
}

export class KyselyDelegatedAuthorizationAdapter implements DelegatedAuthorizationStore {
  constructor(private readonly db: Kysely<IamDatabase>) {}

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
        if (accountId !== null) {
          await transaction
            .selectFrom("iam_users")
            .select("id")
            .where("id", "=", accountId)
            .forUpdate()
            .executeTakeFirst();
        }
        return run(new KyselyDelegatedAuthorizationTransaction(transaction));
      });
  }
}
