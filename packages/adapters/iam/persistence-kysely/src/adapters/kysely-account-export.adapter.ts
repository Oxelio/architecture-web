import { randomUUID } from "node:crypto";

import type { AccountExportStore } from "@architecture/iam/application";
import { createIamSecurityEvent } from "@architecture/iam/application";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely } from "kysely";

import type { IamDatabase } from "#persistence/schema";
export class KyselyAccountExportAdapter implements AccountExportStore {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox: (trx: Kysely<IamDatabase>) => OutboxWriter,
  ) {}
  async reserve(userId: string, id: string, now: Date) {
    return this.db.transaction().execute(async (trx) => {
      const user = await trx
        .selectFrom("iam_users")
        .select("status")
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (user?.status !== "active") {
        return null;
      }
      const existing = await trx
        .selectFrom("iam_account_exports")
        .selectAll()
        .where("user_id", "=", userId)
        .where("status", "in", ["pending", "ready"])
        .where((eb) =>
          eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]),
        )
        .orderBy("created_at", "desc")
        .executeTakeFirst();
      if (existing) {
        return { id: existing.id, status: existing.status, created: false };
      }
      await trx
        .insertInto("iam_account_exports")
        .values({
          id,
          user_id: userId,
          status: "pending",
          archive: null,
          failure_code: null,
          expires_at: null,
          downloaded_at: null,
          created_at: now,
          updated_at: now,
        })
        .execute();
      return { id, status: "pending", created: true };
    });
  }
  async readData(userId: string) {
    const [account, identities, exports, deletions] = await Promise.all([
      this.db
        .selectFrom("iam_users")
        .select(["id", "role", "status", "created_at", "updated_at"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow(),
      this.db
        .selectFrom("iam_login_identities")
        .select([
          "kind",
          "normalized_value",
          "verification_status",
          "verified_at",
          "created_at",
          "updated_at",
        ])
        .where("user_id", "=", userId)
        .orderBy("created_at", "asc")
        .execute(),
      this.db
        .selectFrom("iam_account_exports")
        .select(["id", "status", "created_at", "expires_at", "downloaded_at"])
        .where("user_id", "=", userId)
        .execute(),
      this.db
        .selectFrom("iam_account_deletions")
        .select([
          "id",
          "requested_at",
          "scheduled_for",
          "cancelled_at",
          "executed_at",
        ])
        .where("user_id", "=", userId)
        .execute(),
    ]);
    return {
      account: {
        id: account.id,
        role: account.role,
        status: account.status,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
        loginIdentities: identities.map((identity) => ({
          kind: identity.kind,
          value: identity.normalized_value,
          verificationStatus: identity.verification_status,
          verifiedAt: identity.verified_at,
          createdAt: identity.created_at,
          updatedAt: identity.updated_at,
        })),
      },
      requests: { exports, deletions },
    };
  }
  async complete(id: string, archive: Uint8Array, now: Date) {
    await this.db.transaction().execute(async (trx) => {
      const row = await trx
        .updateTable("iam_account_exports")
        .set({
          status: "ready",
          archive: Buffer.from(archive),
          expires_at: new Date(now.getTime() + 86400000),
          updated_at: now,
        })
        .where("id", "=", id)
        .where("status", "=", "pending")
        .returning("user_id")
        .executeTakeFirstOrThrow();
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "account.export.generated",
          userId: row.user_id,
          eventId: randomUUID(),
          occurredAt: new Date(),
          exportId: id,
        }),
      ]);
    });
  }
  async fail(id: string, now: Date) {
    await this.db
      .updateTable("iam_account_exports")
      .set({
        status: "failed",
        archive: null,
        failure_code: "GENERATION_FAILED",
        updated_at: now,
      })
      .where("id", "=", id)
      .execute();
  }
  async list(userId: string, now: Date) {
    await this.db
      .updateTable("iam_account_exports")
      .set({ status: "expired", archive: null, updated_at: now })
      .where("user_id", "=", userId)
      .where("status", "=", "ready")
      .where("expires_at", "<=", now)
      .execute();
    return this.db
      .selectFrom("iam_account_exports")
      .select([
        "id",
        "status",
        "failure_code",
        "expires_at",
        "downloaded_at",
        "created_at",
      ])
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
  }
  async take(userId: string, id: string, now: Date) {
    return this.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom("iam_account_exports")
        .selectAll()
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !row?.archive ||
        row.status !== "ready" ||
        !row.expires_at ||
        row.expires_at <= new Date(Math.max(now.getTime(), Date.now()))
      ) {
        return null;
      }
      await trx
        .updateTable("iam_account_exports")
        .set({
          status: "expired",
          archive: null,
          downloaded_at: now,
          updated_at: now,
        })
        .where("id", "=", id)
        .execute();
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "account.export.downloaded",
          userId: userId,
          eventId: randomUUID(),
          occurredAt: new Date(),
          exportId: id,
        }),
      ]);
      return new Uint8Array(row.archive);
    });
  }
  async expire(now: Date) {
    await this.db
      .updateTable("iam_account_exports")
      .set({ status: "expired", archive: null, updated_at: now })
      .where("status", "=", "ready")
      .where("expires_at", "<=", now)
      .execute();
  }
}
