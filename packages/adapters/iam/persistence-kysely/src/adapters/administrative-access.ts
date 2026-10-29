import {
  parseStoredSecurityPolicy,
  type SecurityPolicy,
} from "@architecture/iam/domain";
import { type Kysely, sql } from "kysely";

import type { IamDatabase } from "#persistence/schema";
/** Acquire before configuration/account/credential locks in every participating writer. */
export async function lockAdministrativeAccess(db: Kysely<IamDatabase>) {
  await sql`select pg_advisory_xact_lock(728194002)`.execute(db);
}
export async function currentAccessPolicy(db: Kysely<IamDatabase>) {
  const row = await db
    .selectFrom("iam_security_config_revisions")
    .selectAll()
    .where("status", "=", "published")
    .executeTakeFirstOrThrow();
  const parsed = parseStoredSecurityPolicy(
    row.values,
    row.representation_version,
  );
  if (!parsed.success) {
    throw new Error(
      `Unsupported or corrupt IAM configuration revision ${row.id}`,
    );
  }
  return parsed.value;
}
export async function hasAdministrativeAccess(
  db: Kysely<IamDatabase>,
  policy: SecurityPolicy,
  excluding?: string,
  excludingIdentity?: string,
) {
  let query = db
    .selectFrom("iam_users as u")
    .innerJoin("iam_password_authenticators as p", "p.user_id", "u.id")
    .innerJoin("iam_login_identities as i", "i.user_id", "u.id")
    .leftJoin("iam_mfa_settings as m", "m.user_id", "u.id")
    .select("u.id")
    .where("u.role", "=", "admin")
    .where("u.status", "=", "active")
    .where("p.revoked_at", "is", null)
    .where("i.verification_status", "!=", "pending")
    .where("i.kind", "in", policy.accounts.allowedLoginIdentifiers);
  if (excludingIdentity) {
    query = query.where("i.id", "!=", excludingIdentity);
  }
  if (excluding) {
    query = query.where("u.id", "!=", excluding);
  }
  if (policy.authentication.mfaRequiredRoles.includes("admin")) {
    query = query.where("m.enabled_at", "is not", null);
  }
  return Boolean(await query.executeTakeFirst());
}
