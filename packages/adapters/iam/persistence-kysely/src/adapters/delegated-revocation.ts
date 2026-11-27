import { randomUUID } from "node:crypto";

import {
  type AccountDelegatedInvalidation,
  createDelegatedRevocationFact,
  createDelegatedWithdrawalFact,
} from "@architecture/iam/application";
import type { ClientApplicationState } from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";
import { sql, type Transaction } from "kysely";

import type { IamDatabase } from "#persistence/schema";

/** The owning security transaction holds the administrative fence and the account row. */
export async function invalidateDelegatedAccount(
  trx: Transaction<IamDatabase>,
  outbox: OutboxWriter | undefined,
  { accountId, reason, actor }: AccountDelegatedInvalidation,
) {
  await trx
    .insertInto("iam_delegated_account_epochs")
    .values({ account_id: accountId, epoch: "1" })
    .onConflict((conflict) =>
      conflict.column("account_id").doUpdateSet({
        epoch: sql<string>`iam_delegated_account_epochs.epoch + 1`,
      }),
    )
    .execute();
  const occurredAt = new Date();
  const revoked = await trx
    .updateTable("iam_delegated_grants")
    .set({ revoked_at: occurredAt })
    .where("account_id", "=", accountId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  if (!revoked.numUpdatedRows) {
    return;
  }
  if (!outbox) {
    throw new Error("Delegated revocation requires the transactional outbox");
  }
  await outbox.append([
    createDelegatedRevocationFact({
      userId: accountId,
      operationId: randomUUID(),
      occurredAt,
      actor,
      reason,
      affectedGrantCount: Number(revoked.numUpdatedRows),
    }),
  ]);
}

export async function appendDelegatedFacts(
  outbox: OutboxWriter | undefined,
  facts: readonly IntegrationEvent[],
) {
  if (facts.length === 0) {
    return;
  }
  if (!outbox) {
    throw new Error("Delegated revocation requires the transactional outbox");
  }
  // Keep each parameter-bounded batch on the same transaction and stop at the first failed write.
  const batchSize = 250;
  async function appendBatch(
    writer: OutboxWriter,
    offset: number,
  ): Promise<void> {
    const next = offset + batchSize;
    await writer.append(facts.slice(offset, next));
    if (next < facts.length) {
      await appendBatch(writer, next);
    }
  }
  await appendBatch(outbox, 0);
}

/** Lock affected accounts in stable order before the client revision and its grants. */
export async function lockDelegatedClientAccounts(
  trx: Transaction<IamDatabase>,
  clientId: string,
  administratorId?: string,
) {
  await trx
    .selectFrom("iam_users")
    .select("id")
    .where(({ eb, or, exists, selectFrom }) => {
      const affected = exists(
        selectFrom("iam_delegated_grants")
          .select("id")
          .whereRef("account_id", "=", "iam_users.id")
          .where("client_id", "=", clientId)
          .where("revoked_at", "is", null),
      );
      return administratorId
        ? or([affected, eb("iam_users.id", "=", administratorId)])
        : affected;
    })
    .orderBy("id")
    .forUpdate()
    .execute();
}

interface ClientGrantEffect {
  readonly grant_id: string;
  readonly account_id: string;
  readonly resource_id: string;
  readonly revoke: boolean;
  readonly withdrawn: string[];
}

export async function invalidateDelegatedClient(
  trx: Transaction<IamDatabase>,
  outbox: OutboxWriter | undefined,
  client: ClientApplicationState,
  administratorId: string,
) {
  const occurredAt = new Date();
  const affected = await sql<ClientGrantEffect>`
    with policies as (
      select * from jsonb_to_recordset(${JSON.stringify(client.policies)}::jsonb)
        as p("resourceId" text, required jsonb, optional jsonb)
    ), candidates as (
      select g.id, kept.permissions,
        (not ${client.enabled} or p."resourceId" is null or exists (
          select 1 from jsonb_array_elements_text(p.required) as required(code)
          where not exists (select 1 from jsonb_array_elements(kept.permissions) as item
            where item->>'code' = required.code)
        )) as revoke,
        array(select item->>'code' from jsonb_array_elements(g.permissions) as item
           where not coalesce((p.required || p.optional) ? (item->>'code'), false)) as withdrawn
      from iam_delegated_grants g
      left join policies p on p."resourceId" = g.resource_id
      cross join lateral (
        select coalesce(jsonb_agg(item order by ordinal), '[]'::jsonb) as permissions
        from jsonb_array_elements(g.permissions) with ordinality as entitlement(item, ordinal)
        where (p.required || p.optional) ? (item->>'code')
      ) kept
      where g.client_id = ${client.id} and g.revoked_at is null
      order by g.id for update of g
    )
    update iam_delegated_grants g
    set revoked_at = case when c.revoke then ${occurredAt}::timestamptz else null end,
        permissions = case when c.revoke then g.permissions else c.permissions end
    from candidates c
    where c.id = g.id and (c.revoke or cardinality(c.withdrawn) > 0)
    returning g.id as grant_id, g.account_id, g.resource_id, c.revoke, c.withdrawn
  `.execute(trx);
  const operationId = randomUUID();
  const actor = {
    actorType: "administrator",
    actorId: administratorId,
  } as const;
  const revokedByAccount = new Map<string, number>();
  const facts: IntegrationEvent[] = [];
  for (const effect of affected.rows) {
    if (effect.revoke) {
      revokedByAccount.set(
        effect.account_id,
        (revokedByAccount.get(effect.account_id) ?? 0) + 1,
      );
    } else {
      facts.push(
        createDelegatedWithdrawalFact({
          userId: effect.account_id,
          grantId: effect.grant_id,
          resourceId: effect.resource_id,
          clientId: client.id,
          permissions: effect.withdrawn,
          occurredAt,
          operationId,
          actor,
        }),
      );
    }
  }
  for (const [userId, count] of revokedByAccount) {
    facts.push(
      createDelegatedRevocationFact({
        userId,
        clientId: client.id,
        reason: client.enabled ? "client_policy_changed" : "client_disabled",
        affectedGrantCount: count,
        occurredAt,
        operationId,
        actor,
      }),
    );
  }
  await appendDelegatedFacts(outbox, facts);
}
