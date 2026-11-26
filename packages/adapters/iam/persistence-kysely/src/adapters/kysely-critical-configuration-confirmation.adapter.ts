import { createHash } from "node:crypto";

import type {
  CriticalConfigurationConfirmationStore,
  CriticalConfigurationSecurityState,
} from "@architecture/iam/application";
import { type Kysely, sql } from "kysely";

import type { IamDatabase } from "#persistence/schema";

import { lockAdministrativeAccess } from "./administrative-access.js";

export class KyselyCriticalConfigurationConfirmationAdapter implements CriticalConfigurationConfirmationStore {
  constructor(private readonly db: Kysely<IamDatabase>) {}

  admit(
    input: Parameters<CriticalConfigurationConfirmationStore["admit"]>[0],
    checkEligibility: Parameters<
      CriticalConfigurationConfirmationStore["admit"]
    >[1],
  ): ReturnType<CriticalConfigurationConfirmationStore["admit"]> {
    return this.db.transaction().execute(async (trx) => {
      await lockAdministrativeAccess(trx);
      const current = await trx
        .selectFrom("iam_security_config_revisions")
        .select("version")
        .where("status", "=", "published")
        .executeTakeFirstOrThrow();
      if (current.version !== input.expectedVersion) {
        return { success: false, error: "version_conflict" };
      }
      const security = await this.lockedState(trx, input.actorId);
      if (!security.success) {
        return security;
      }
      const refusal = checkEligibility(security.value);
      if (refusal) {
        return { success: false, error: refusal };
      }
      const reserved = await sql`
        with admission_time as materialized (
          select clock_timestamp() as admitted_at
        ), allowance as (
          select admitted_at, array(
            select attempt
            from iam_critical_configuration_attempts
            cross join lateral unnest(timestamps) as attempt
            where user_id = ${input.actorId}
              and attempt > admitted_at - interval '5 minutes'
            order by attempt
          ) as retained
          from admission_time
        )
        insert into iam_critical_configuration_attempts (user_id, timestamps)
        select ${input.actorId}::uuid, array_append(retained, admitted_at)
        from allowance
        where cardinality(retained) < 5
        on conflict (user_id) do update set timestamps = excluded.timestamps
        returning user_id
      `.execute(trx);
      return reserved.rows.length === 1
        ? security
        : { success: false, error: "attempts_exhausted" };
    });
  }

  authorize(
    actorId: string,
    expected: CriticalConfigurationSecurityState,
    checkOriginatingSession: Parameters<
      CriticalConfigurationConfirmationStore["authorize"]
    >[2],
  ): ReturnType<CriticalConfigurationConfirmationStore["authorize"]> {
    return this.db.transaction().execute(async (trx) => {
      await lockAdministrativeAccess(trx);
      const security = await this.lockedState(trx, actorId);
      if (!security.success) {
        return security.error;
      }
      if (security.value.sessionVersion !== expected.sessionVersion) {
        return "session_invalid";
      }
      if (security.value.comparison !== expected.comparison) {
        return "confirmation_refused";
      }
      return checkOriginatingSession();
    });
  }

  private async lockedState(trx: Kysely<IamDatabase>, actorId: string) {
    const actor = await trx
      .selectFrom("iam_users")
      .select(["status", "role", "session_version"])
      .where("id", "=", actorId)
      .forUpdate()
      .executeTakeFirst();
    if (actor?.status !== "active" || actor.role !== "admin") {
      return { success: false, error: "unauthorized" } as const;
    }
    const credential = await trx
      .selectFrom("iam_password_authenticators")
      .select(["id", "password_hash"])
      .where("user_id", "=", actorId)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
    if (!credential) {
      return { success: false, error: "confirmation_refused" } as const;
    }
    const mfa = await trx
      .selectFrom("iam_mfa_settings")
      .select(["encrypted_secret", "enabled_at"])
      .where("user_id", "=", actorId)
      .executeTakeFirst();
    const backupCodes = await trx
      .selectFrom("iam_mfa_backup_codes")
      .select("id")
      .where("user_id", "=", actorId)
      .orderBy("id")
      .execute();
    const comparison = createHash("sha256")
      .update(JSON.stringify([actor, credential, mfa ?? null, backupCodes]))
      .digest("hex");
    return {
      success: true,
      value: {
        comparison,
        sessionVersion: actor.session_version,
        mfaEnabled: Boolean(mfa?.enabled_at),
      },
    } as const;
  }
}
