import { randomUUID } from "node:crypto";

import type { MfaStore } from "@architecture/iam/application";
import { createIamSecurityEvent } from "@architecture/iam/application";
import {
  isMfaChallengeUsable,
  isMfaEnrollmentUsable,
  type MfaChallenge,
  type MfaCredential,
  type UserEntity,
} from "@architecture/iam/domain";
import type { OutboxWriter } from "@architecture/messaging/application";
import type { Kysely, Selectable } from "kysely";

import type {
  IamDatabase,
  IamMfaChallengeTable,
  IamMfaSettingTable,
} from "#persistence/schema";

import {
  currentAccessPolicy,
  lockAdministrativeAccess,
} from "./administrative-access.js";
import { KyselyUserAdapter } from "./kysely-user.adapter.js";

function credential(row: IamMfaSettingTable): MfaCredential {
  const lastCounter =
    row.last_totp_counter === null ? null : Number(row.last_totp_counter);
  if (
    lastCounter !== null &&
    (!Number.isSafeInteger(lastCounter) || lastCounter < 0)
  ) {
    throw new Error("Invalid persisted MFA counter");
  }
  return {
    userId: row.user_id,
    sealedSecret: row.encrypted_secret,
    enrollmentExpiresAt: row.enrollment_expires_at,
    enabledAt: row.enabled_at,
    lastCounter,
  };
}
function challenge(row: Selectable<IamMfaChallengeTable>): MfaChallenge {
  if (
    !Number.isSafeInteger(row.attempts) ||
    row.attempts < 0 ||
    !Number.isSafeInteger(row.max_attempts) ||
    row.max_attempts < 1 ||
    !Number.isFinite(row.expires_at.getTime())
  ) {
    throw new Error("Invalid persisted MFA challenge");
  }
  if (row.purpose !== "signin" && row.purpose !== "enrollment_confirmation") {
    throw new Error("Unknown persisted MFA challenge purpose");
  }
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    attempts: row.attempts,
    maximumAttempts: row.max_attempts,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    userSessionVersion: row.user_session_version,
  };
}
export class KyselyMfaAdapter implements MfaStore {
  constructor(
    private readonly db: Kysely<IamDatabase>,
    private readonly outbox: (trx: Kysely<IamDatabase>) => OutboxWriter,
  ) {}
  private async lockAccount(trx: Kysely<IamDatabase>, userId: string) {
    await lockAdministrativeAccess(trx);
    return trx
      .selectFrom("iam_users")
      .selectAll()
      .where("id", "=", userId)
      .forUpdate()
      .executeTakeFirst();
  }
  async credential(userId: string) {
    const row = await this.db
      .selectFrom("iam_mfa_settings")
      .selectAll()
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? credential(row) : null;
  }
  async remainingBackupCodes(userId: string) {
    const row = await this.db
      .selectFrom("iam_mfa_backup_codes")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .where("consumed_at", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
  async beginEnrollment(value: MfaCredential, now: Date) {
    return this.db.transaction().execute(async (trx) => {
      await this.lockAccount(trx, value.userId);
      const setting = await trx
        .selectFrom("iam_mfa_settings")
        .selectAll()
        .where("user_id", "=", value.userId)
        .forUpdate()
        .executeTakeFirst();
      if (setting?.enabled_at) {
        return false;
      }
      await trx
        .insertInto("iam_mfa_settings")
        .values({
          user_id: value.userId,
          encrypted_secret: value.sealedSecret,
          enrollment_expires_at: value.enrollmentExpiresAt,
          enabled_at: null,
          last_totp_counter: null,
          created_at: now,
          updated_at: now,
        })
        .onConflict((c) =>
          c.column("user_id").doUpdateSet({
            encrypted_secret: value.sealedSecret,
            enrollment_expires_at: value.enrollmentExpiresAt,
            last_totp_counter: null,
            updated_at: now,
          }),
        )
        .execute();
      await trx
        .deleteFrom("iam_mfa_challenges")
        .where("user_id", "=", value.userId)
        .where("purpose", "=", "enrollment_confirmation")
        .execute();
      return true;
    });
  }
  private async backupCodes(
    trx: Kysely<IamDatabase>,
    userId: string,
    hashes: readonly string[],
    now: Date,
  ) {
    await trx
      .deleteFrom("iam_mfa_backup_codes")
      .where("user_id", "=", userId)
      .execute();
    await trx
      .insertInto("iam_mfa_backup_codes")
      .values(
        hashes.map((hash) => ({
          id: randomUUID(),
          user_id: userId,
          code_hash: hash,
          consumed_at: null,
          created_at: now,
        })),
      )
      .execute();
  }
  async confirmEnrollment(input: Parameters<MfaStore["confirmEnrollment"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      await this.lockAccount(trx, input.userId);
      const row = await trx
        .selectFrom("iam_mfa_settings")
        .selectAll()
        .where("user_id", "=", input.userId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !row ||
        !row.enrollment_expires_at ||
        row.encrypted_secret !== input.sealedSecret ||
        !isMfaEnrollmentUsable(
          credential(row),
          new Date(Math.max(input.now.getTime(), Date.now())),
        ) ||
        Math.abs(input.counter - Math.floor(Date.now() / 30000)) > 1 ||
        (row.last_totp_counter !== null &&
          input.counter <= Number(row.last_totp_counter))
      ) {
        return false;
      }
      await trx
        .updateTable("iam_mfa_settings")
        .set({
          last_totp_counter: String(input.counter),
          updated_at: input.now,
        })
        .where("user_id", "=", input.userId)
        .execute();
      await this.backupCodes(trx, input.userId, input.backupHashes, input.now);
      await trx
        .deleteFrom("iam_mfa_challenges")
        .where("user_id", "=", input.userId)
        .where("purpose", "=", "enrollment_confirmation")
        .execute();
      await trx
        .insertInto("iam_mfa_challenges")
        .values({
          id: input.confirmationId,
          user_id: input.userId,
          purpose: "enrollment_confirmation",
          attempts: 0,
          max_attempts: 1,
          expires_at: row.enrollment_expires_at,
          consumed_at: null,
          created_at: input.now,
        })
        .execute();
      return true;
    });
  }
  async activate(input: Parameters<MfaStore["activate"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      const account = await this.lockAccount(trx, input.user.identifier.value);
      if (
        !account ||
        account.status !== "active" ||
        account.role !== input.user.role.value ||
        account.session_version !== input.user.sessionVersion - 1
      ) {
        return false;
      }
      const setting = await trx
        .selectFrom("iam_mfa_settings")
        .selectAll()
        .where("user_id", "=", account.id)
        .forUpdate()
        .executeTakeFirst();
      const row = await trx
        .selectFrom("iam_mfa_challenges")
        .selectAll()
        .where("id", "=", input.confirmationId)
        .where("user_id", "=", account.id)
        .forUpdate()
        .executeTakeFirst();
      if (
        !setting ||
        !isMfaEnrollmentUsable(
          credential(setting),
          new Date(Math.max(input.now.getTime(), Date.now())),
        ) ||
        !row ||
        row.purpose !== "enrollment_confirmation" ||
        !isMfaChallengeUsable(
          challenge(row),
          new Date(Math.max(input.now.getTime(), Date.now())),
        )
      ) {
        return false;
      }
      await trx
        .updateTable("iam_mfa_challenges")
        .set({ consumed_at: input.now })
        .where("id", "=", row.id)
        .execute();
      await trx
        .updateTable("iam_mfa_settings")
        .set({
          enabled_at: input.now,
          enrollment_expires_at: null,
          updated_at: input.now,
        })
        .where("user_id", "=", account.id)
        .execute();
      await new KyselyUserAdapter(trx, this.outbox(trx)).save(input.user);
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "mfa.activated",
          userId: account.id,
          eventId: randomUUID(),
          occurredAt: new Date(),
        }),
      ]);
      return true;
    });
  }
  async findChallenge(id: string) {
    const row = await this.db
      .selectFrom("iam_mfa_challenges")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? challenge(row) : null;
  }
  async beginChallenge(input: Parameters<MfaStore["beginChallenge"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      const account = await this.lockAccount(trx, input.userId);
      if (
        !account ||
        account.status !== "active" ||
        account.session_version !== input.userSessionVersion
      ) {
        return null;
      }
      const existing = await trx
        .selectFrom("iam_mfa_challenges")
        .selectAll()
        .where("user_id", "=", input.userId)
        .where("purpose", "=", "signin")
        .where("user_session_version", "=", input.userSessionVersion)
        .where("consumed_at", "is", null)
        .where("expires_at", ">", input.now)
        .orderBy("created_at", "desc")
        .executeTakeFirst();
      if (existing) {
        return challenge(existing);
      }
      const row = await trx
        .insertInto("iam_mfa_challenges")
        .values({
          id: input.id,
          user_id: input.userId,
          purpose: "signin",
          user_session_version: input.userSessionVersion,
          attempts: 0,
          max_attempts: input.maximumAttempts,
          expires_at: input.expiresAt,
          consumed_at: null,
          created_at: input.now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return challenge(row);
    });
  }
  async verify(input: Parameters<MfaStore["verify"]>[0]) {
    return this.db.transaction().execute(async (trx) => {
      const account = await this.lockAccount(trx, input.userId);
      if (!account || (input.challengeId && account.status !== "active")) {
        return null;
      }
      const setting = await trx
        .selectFrom("iam_mfa_settings")
        .selectAll()
        .where("user_id", "=", input.userId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !setting?.enabled_at ||
        setting.encrypted_secret !== input.sealedSecret
      ) {
        return null;
      }
      const currentCredential = credential(setting);
      if (input.challengeId) {
        const row = await trx
          .selectFrom("iam_mfa_challenges")
          .selectAll()
          .where("id", "=", input.challengeId)
          .where("user_id", "=", input.userId)
          .forUpdate()
          .executeTakeFirst();
        if (
          !row ||
          row.purpose !== "signin" ||
          row.user_session_version !== account.session_version ||
          !isMfaChallengeUsable(
            challenge(row),
            new Date(Math.max(input.now.getTime(), Date.now())),
          )
        ) {
          return null;
        }
        await trx
          .updateTable("iam_mfa_challenges")
          .set({ attempts: row.attempts + 1 })
          .where("id", "=", row.id)
          .execute();
      }
      let method: "totp" | "backup_code" | null = null;
      // A proof computed before waiting for a row lock must still belong to
      // the configured 30-second TOTP window at the time of consumption.
      const counter =
        input.counter !== null &&
        Math.abs(input.counter - Math.floor(Date.now() / 30000)) <= 1
          ? input.counter
          : null;
      if (
        counter !== null &&
        (currentCredential.lastCounter === null ||
          counter > currentCredential.lastCounter)
      ) {
        await trx
          .updateTable("iam_mfa_settings")
          .set({
            last_totp_counter: String(counter),
            updated_at: input.now,
          })
          .where("user_id", "=", input.userId)
          .execute();
        method = "totp";
      } else {
        const backup = await trx
          .updateTable("iam_mfa_backup_codes")
          .set({ consumed_at: input.now })
          .where("user_id", "=", input.userId)
          .where("code_hash", "=", input.backupHash)
          .where("consumed_at", "is", null)
          .executeTakeFirst();
        if (Number(backup.numUpdatedRows) === 1) {
          method = "backup_code";
        }
      }
      if (method && input.challengeId) {
        await trx
          .updateTable("iam_mfa_challenges")
          .set({ consumed_at: input.now })
          .where("id", "=", input.challengeId)
          .execute();
      }
      if (method === "backup_code") {
        await this.outbox(trx).append([
          createIamSecurityEvent({
            type: "mfa.backup_code.used",
            userId: input.userId,
            eventId: randomUUID(),
            occurredAt: input.now,
          }),
        ]);
      }
      return method;
    });
  }
  async replaceBackupCodes(
    userId: string,
    hashes: readonly string[],
    now: Date,
  ) {
    return this.db.transaction().execute(async (trx) => {
      const user = await this.lockAccount(trx, userId);
      const setting = await trx
        .selectFrom("iam_mfa_settings")
        .select("enabled_at")
        .where("user_id", "=", userId)
        .forUpdate()
        .executeTakeFirst();
      if (!user || user.status !== "active" || !setting?.enabled_at) {
        return false;
      }
      await this.backupCodes(trx, userId, hashes, now);
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "mfa.backup_codes.regenerated",
          userId: userId,
          eventId: randomUUID(),
          occurredAt: new Date(),
        }),
      ]);
      return true;
    });
  }
  async disable(user: UserEntity) {
    return this.db.transaction().execute(async (trx) => {
      await lockAdministrativeAccess(trx);
      const policy = await currentAccessPolicy(trx);
      const account = await this.lockAccount(trx, user.identifier.value);
      if (policy.authentication.mfaRequiredRoles.includes(user.role.value)) {
        return false;
      }
      if (
        !account ||
        account.status !== user.status.value ||
        account.role !== user.role.value ||
        account.session_version !== user.sessionVersion - 1
      ) {
        return false;
      }
      await trx
        .deleteFrom("iam_mfa_settings")
        .where("user_id", "=", account.id)
        .execute();
      await trx
        .deleteFrom("iam_mfa_backup_codes")
        .where("user_id", "=", account.id)
        .execute();
      await trx
        .updateTable("iam_mfa_challenges")
        .set({ consumed_at: new Date() })
        .where("user_id", "=", account.id)
        .where("consumed_at", "is", null)
        .execute();
      await new KyselyUserAdapter(trx, this.outbox(trx)).save(user);
      await this.outbox(trx).append([
        createIamSecurityEvent({
          type: "mfa.disabled",
          userId: account.id,
          eventId: randomUUID(),
          occurredAt: new Date(),
        }),
      ]);
      return true;
    });
  }
}
