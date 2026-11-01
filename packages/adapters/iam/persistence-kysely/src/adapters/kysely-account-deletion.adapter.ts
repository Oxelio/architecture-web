import { createHash, randomUUID } from "node:crypto";

import type {
  AccountDeletionStore,
  DeletionRequest,
} from "@architecture/iam/application";
import { createIamSecurityEvent } from "@architecture/iam/application";
import type { OutboxWriter } from "@architecture/messaging/application";
import { type Kysely, sql } from "kysely";

import type { IamAccountDeletionTable, IamDatabase } from "#persistence/schema";

import {
  currentAccessPolicy,
  hasAdministrativeAccess,
} from "./administrative-access.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";
function deletion(row: IamAccountDeletionTable): DeletionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    previousStatus: row.previous_status,
    scheduledFor: row.scheduled_for,
    cancelledAt: row.cancelled_at,
    executedAt: row.executed_at,
  };
}
export class KyselyAccountDeletionAdapter implements AccountDeletionStore {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox: (trx: Kysely<IamDatabase>) => OutboxWriter,
  ) {}
  async request(input: Parameters<AccountDeletionStore["request"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(728194002)`.execute(trx);
      const account = await trx
        .selectFrom("iam_users")
        .selectAll()
        .where("id", "=", input.user.identifier.value)
        .forUpdate()
        .executeTakeFirst();
      if (
        account?.session_version !== input.user.sessionVersion - 1 ||
        account.status !== input.previousStatus ||
        account.role !== input.user.role.value
      ) {
        return "conflict" as const;
      }
      if (input.requireAnotherAdministrator) {
        const other = await hasAdministrativeAccess(
          trx,
          await currentAccessPolicy(trx),
          account.id,
        );
        if (!other) {
          return "last_administrator" as const;
        }
      }
      await trx
        .insertInto("iam_account_deletions")
        .values({
          id: input.id,
          user_id: account.id,
          previous_status: input.previousStatus,
          cancellation_token_hash: input.tokenHash,
          requested_at: input.now,
          scheduled_for: input.scheduledFor,
          cancelled_at: null,
          executed_at: null,
          legal_hold_reason: null,
        })
        .onConflict((c) =>
          c.column("user_id").doUpdateSet({
            previous_status: input.previousStatus,
            cancellation_token_hash: input.tokenHash,
            requested_at: input.now,
            scheduled_for: input.scheduledFor,
            cancelled_at: null,
            executed_at: null,
          }),
        )
        .execute();
      await new KyselyUserAdapter(trx, this.outbox(trx)).save(input.user);
      await trx
        .updateTable("iam_password_recoveries")
        .set({ invalidated_at: input.now })
        .where("user_id", "=", account.id)
        .where("consumed_at", "is", null)
        .execute();
      await trx
        .updateTable("iam_email_verifications")
        .set({ invalidated: true })
        .where("user_id", "=", account.id)
        .execute();
      await trx
        .updateTable("iam_mfa_challenges")
        .set({ consumed_at: input.now })
        .where("user_id", "=", account.id)
        .where("consumed_at", "is", null)
        .execute();
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "account.deletion.requested",
          userId: account.id,
          eventId: randomUUID(),
          occurredAt: new Date(),
          scheduledFor: input.scheduledFor.toISOString(),
        }),
      ]);
      return "saved" as const;
    });
  }
  async find(tokenHash: string) {
    const row = await this.db
      .selectFrom("iam_account_deletions")
      .selectAll()
      .where("cancellation_token_hash", "=", tokenHash)
      .executeTakeFirst();
    return row ? deletion(row) : null;
  }
  async cancel(input: Parameters<AccountDeletionStore["cancel"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("iam_users")
        .selectAll()
        .where("id", "=", input.user.identifier.value)
        .forUpdate()
        .executeTakeFirst();
      if (
        user?.status !== "pending_deletion" ||
        user.session_version !== input.user.sessionVersion ||
        user.role !== input.user.role.value
      ) {
        return false;
      }
      const result = await trx
        .updateTable("iam_account_deletions")
        .set({ cancelled_at: input.now })
        .where("id", "=", input.requestId)
        .where("user_id", "=", user.id)
        .where("cancelled_at", "is", null)
        .where("executed_at", "is", null)
        .where(
          "scheduled_for",
          ">",
          new Date(Math.max(input.now.getTime(), Date.now())),
        )
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) !== 1) {
        return false;
      }
      await new KyselyUserAdapter(trx, this.outbox(trx)).save(input.user);
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "account.deletion.cancelled",
          userId: user.id,
          eventId: randomUUID(),
          occurredAt: new Date(),
        }),
      ]);
      return true;
    });
  }
  async due(now: Date) {
    return (
      await this.db
        .selectFrom("iam_account_deletions")
        .selectAll()
        .where("scheduled_for", "<=", now)
        .where("cancelled_at", "is", null)
        .where("executed_at", "is", null)
        .where("legal_hold_reason", "is", null)
        .execute()
    ).map(deletion);
  }
  async eraseIfDue(
    id: string,
    now: Date,
    beforeErase: (userId: string) => Promise<void>,
  ) {
    return this.db.transaction().execute(async (trx) => {
      const initial = await trx
        .selectFrom("iam_account_deletions")
        .select("user_id")
        .where("id", "=", id)
        .executeTakeFirst();
      if (!initial) {
        return null;
      }
      const user = await trx
        .selectFrom("iam_users")
        .selectAll()
        .where("id", "=", initial.user_id)
        .forUpdate()
        .executeTakeFirst();
      if (user?.status !== "pending_deletion") {
        return null;
      }
      const row = await trx
        .selectFrom("iam_account_deletions")
        .selectAll()
        .where("id", "=", id)
        .where("scheduled_for", "<=", now)
        .where("cancelled_at", "is", null)
        .where("executed_at", "is", null)
        .where("legal_hold_reason", "is", null)
        .forUpdate()
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      await beforeErase(row.user_id);
      await trx.deleteFrom("iam_users").where("id", "=", row.user_id).execute();
      const pseudonym = createHash("sha256").update(row.user_id).digest("hex");
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "account.deletion.executed",
          eventId: randomUUID(),
          occurredAt: now,
          pseudonymousSubject: pseudonym,
        }),
      ]);
      return row.user_id;
    });
  }
}
