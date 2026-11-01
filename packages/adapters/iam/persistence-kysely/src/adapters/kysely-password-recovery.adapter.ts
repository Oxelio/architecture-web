import { randomUUID } from "node:crypto";

import type {
  PasswordRecoveryStore,
  RecoveryCommit,
} from "@architecture/iam/application";
import { createIamSecurityEvent } from "@architecture/iam/application";
import {
  isRecoveryTokenUsable,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";

import type { IamDatabase } from "#persistence/schema";

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
      const identity = await trx
        .selectFrom("iam_login_identities")
        .selectAll()
        .where("id", "=", input.identityId)
        .where("user_id", "=", input.userId)
        .where("kind", "=", "email")
        .where("normalized_value", "=", input.email)
        .where("verification_status", "=", "verified")
        .executeTakeFirst();
      const account = await trx
        .selectFrom("iam_users")
        .select("status")
        .where("id", "=", input.userId)
        .executeTakeFirst();
      if (!user || !identity || account?.status !== "active") {
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
          login_identity_id: identity.id,
          identity_generation: identity.generation,
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
      const identity = row.login_identity_id
        ? await trx
            .selectFrom("iam_login_identities")
            .selectAll()
            .where("id", "=", row.login_identity_id)
            .where("user_id", "=", row.user_id)
            .where("kind", "=", "email")
            .where("verification_status", "=", "verified")
            .executeTakeFirst()
        : null;
      if (!identity) {
        return null;
      }
      if (identity.generation !== row.identity_generation) {
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
          await this.outbox(trx).append([
            createIamSecurityEvent({
              type: "account.recovery.completed",
              userId: row.user_id,
              eventId: randomUUID(),
              occurredAt: new Date(),
            }),
          ]);
        },
      });
    });
  }
}
