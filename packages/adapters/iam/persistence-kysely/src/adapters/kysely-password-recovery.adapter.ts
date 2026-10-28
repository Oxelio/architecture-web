import type {
  PasswordRecoveryStore,
  RecoveryCommit,
} from "@architecture/iam/application";
import {
  isRecoveryTokenUsable,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";

import type { IamDatabase } from "#persistence/schema";

import { appendIamSecurityEvent } from "./iam-security-event.js";
import { KyselyPasswordAuthenticatorAdapter } from "./kysely-password-authenticator.adapter.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";
export class KyselyPasswordRecoveryAdapter implements PasswordRecoveryStore {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox: (transaction: Kysely<IamDatabase>) => OutboxWriter,
  ) {}
  async find(tokenHash: string) {
    const row = await this.db
      .selectFrom("iam_password_recoveries")
      .selectAll()
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          expiresAt: row.expires_at,
          consumedAt: row.consumed_at,
          invalidatedAt: row.invalidated_at,
        }
      : null;
  }
  async issue(input: Parameters<PasswordRecoveryStore["issue"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("iam_users")
        .select("id")
        .where("id", "=", input.userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user) {
        return false;
      }
      const recent = await trx
        .selectFrom("iam_password_recoveries")
        .select(({ fn }) => fn.countAll<number>().as("count"))
        .where("user_id", "=", input.userId)
        .where("created_at", ">", new Date(input.now.getTime() - 3600000))
        .executeTakeFirstOrThrow();
      if (Number(recent.count) >= input.maximumPerHour) {
        return false;
      }
      await trx
        .updateTable("iam_password_recoveries")
        .set({ invalidated_at: input.now })
        .where("user_id", "=", input.userId)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .execute();
      await trx
        .insertInto("iam_password_recoveries")
        .values({
          id: input.id,
          user_id: input.userId,
          token_hash: input.tokenHash,
          email_fingerprint: input.emailFingerprint,
          expires_at: input.expiresAt,
          created_at: input.now,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();
      return true;
    });
  }
  async withUsableToken<T>(
    tokenHash: string,
    now: Date,
    work: (commit: RecoveryCommit) => Promise<T>,
  ): Promise<T | null> {
    return this.db.transaction().execute(async (trx) => {
      const initial = await trx
        .selectFrom("iam_password_recoveries")
        .select("user_id")
        .where("token_hash", "=", tokenHash)
        .executeTakeFirst();
      if (!initial) {
        return null;
      }
      const locked = await trx
        .selectFrom("iam_users")
        .select("id")
        .where("id", "=", initial.user_id)
        .forUpdate()
        .executeTakeFirst();
      if (!locked) {
        return null;
      }
      const row = await trx
        .selectFrom("iam_password_recoveries")
        .selectAll()
        .where("token_hash", "=", tokenHash)
        .forUpdate()
        .executeTakeFirst();
      if (
        !row ||
        !isRecoveryTokenUsable(
          {
            id: row.id,
            userId: row.user_id,
            expiresAt: row.expires_at,
            consumedAt: row.consumed_at,
            invalidatedAt: row.invalidated_at,
          },
          new Date(Math.max(now.getTime(), Date.now())),
        )
      ) {
        return null;
      }
      const id = UserIdentifierValueObject.create(row.user_id);
      if (!id.success) {
        throw new Error("Invalid persisted account identifier");
      }
      const outbox = this.outbox(trx),
        users = new KyselyUserAdapter(trx, outbox),
        passwordAuthenticators = new KyselyPasswordAuthenticatorAdapter(
          trx,
          outbox,
        );
      const user = await users.findById(id.value),
        authenticator = await passwordAuthenticators.findForUser(id.value);
      if (!user || !authenticator) {
        return null;
      }
      return work({
        user,
        authenticator,
        users,
        passwordAuthenticators,
        consume: async () => {
          await trx
            .updateTable("iam_password_recoveries")
            .set({ consumed_at: now })
            .where("id", "=", row.id)
            .execute();
          await appendIamSecurityEvent(
            this.outbox(trx),
            "account.recovery.completed",
            row.user_id,
            "anonymous",
          );
        },
      });
    });
  }
}
