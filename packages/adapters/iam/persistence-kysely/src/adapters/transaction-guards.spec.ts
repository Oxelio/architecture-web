import { UserEntity } from "@architecture/iam/domain";
import { Kysely, PostgresDialect, type PostgresPoolClient } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { IamDatabase } from "#persistence/schema";

import { iamAuthenticationProofMigrations } from "../persistence/migrations/007_bind_authentication_proofs.js";
import { iamConfigurationVersionMigrations } from "../persistence/migrations/008_version_configuration.js";
import { KyselyAccountDeletionAdapter } from "./kysely-account-deletion.adapter.js";
import { KyselyAccountExportAdapter } from "./kysely-account-export.adapter.js";
import { KyselyMfaAdapter } from "./kysely-mfa.adapter.js";
import { KyselyPasswordRecoveryAdapter } from "./kysely-password-recovery.adapter.js";
import { KyselySecurityConfigurationAdapter } from "./kysely-security-configuration.adapter.js";

// Compile real Kysely queries; control only the PostgreSQL driver's responses.
function database(rows: Record<string, unknown>, backupRows = 0) {
  const statements: string[] = [];
  const query = vi.fn((sql: string) => {
    statements.push(sql);
    const table = /(?:from|update) "([^"]+)"/.exec(sql)?.[1];
    const row = table ? rows[table] : undefined;
    return Promise.resolve({
      command: sql.startsWith("update")
        ? ("UPDATE" as const)
        : ("SELECT" as const),
      rows: sql.startsWith("select") && row ? [row] : [],
      rowCount: table === "iam_mfa_backup_codes" ? backupRows : 0,
    });
  });
  const db = new Kysely<IamDatabase>({
    dialect: new PostgresDialect({
      pool: {
        options: {},
        connect: () =>
          Promise.resolve({
            query: query as unknown as PostgresPoolClient["query"],
            release: () => undefined,
          }),
        end: () => Promise.resolve(),
      },
    }),
  });
  return { db, statements };
}

const now = new Date();
const counter = Math.floor(now.getTime() / 30000);
const account = {
  id: "account",
  status: "active",
  role: "user",
  session_version: 1,
};
const setting = {
  user_id: "account",
  encrypted_secret: "sealed",
  enabled_at: now,
  enrollment_expires_at: new Date(now.getTime() + 60_000),
  last_totp_counter: null,
};
const challenge = {
  id: "challenge",
  user_id: "account",
  purpose: "signin",
  user_session_version: 1,
  attempts: 0,
  max_attempts: 3,
  expires_at: new Date(now.getTime() + 60_000),
  consumed_at: null,
};
const user = {
  identifier: { value: "account" },
  sessionVersion: 2,
  role: { value: "user" },
};

describe("recovery identity binding", () => {
  it.each(["missing", "unbound", "malformed", "stale", "matching"])(
    "preserves fail-closed recovery checks for %s identity state",
    async (mode) => {
      const accountId = UserEntity.create().identifier.value;
      const { db, statements } = database({
        iam_users: {
          ...account,
          id: accountId,
          created_at: now,
          updated_at: now,
        },
        iam_password_recoveries: {
          id: "recovery",
          user_id: accountId,
          expires_at: new Date(Date.now() + 60_000),
          consumed_at: null,
          invalidated_at: null,
          login_identity_id: mode === "unbound" ? null : "identity",
          identity_generation: mode === "malformed" ? undefined : 1,
        },
        iam_login_identities: ["missing", "malformed", "unbound"].includes(mode)
          ? undefined
          : { generation: mode === "stale" ? 2 : 1 },
      });
      const work = vi.fn(() => Promise.resolve("reset"));
      const adapter = new KyselyPasswordRecoveryAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(await adapter.withUsableToken("token-hash", now, work)).toBeNull();
      expect(work).not.toHaveBeenCalled();
      expect(
        statements.some((sql) =>
          sql.includes('from "iam_password_authenticators"'),
        ),
      ).toBe(mode === "matching");
      expect(statements.some((sql) => sql.startsWith("update"))).toBe(false);
      await db.destroy();
    },
  );
});

describe("transactional MFA proof consumption", () => {
  it.each([
    "missing",
    "no-expiry",
    "changed-secret",
    "expired",
    "old-counter",
    "valid",
  ])("validates enrollment proof against %s settings", async (mode) => {
    const row = {
      ...setting,
      enabled_at: null,
      ...(mode === "no-expiry" ? { enrollment_expires_at: null } : {}),
      ...(mode === "changed-secret" ? { encrypted_secret: "other" } : {}),
      ...(mode === "expired" ? { enrollment_expires_at: new Date(0) } : {}),
      ...(mode === "old-counter" ? { last_totp_counter: String(counter) } : {}),
    };
    const { db } = database({
      iam_users: account,
      iam_mfa_settings: mode === "missing" ? undefined : row,
    });
    const adapter = new KyselyMfaAdapter(db, () => ({
      append: () => Promise.resolve(),
    }));
    expect(
      await adapter.confirmEnrollment({
        userId: "account",
        sealedSecret: "sealed",
        counter,
        now,
        backupHashes: ["backup-hash"],
        confirmationId: "confirmation",
      }),
    ).toBe(mode === "valid");
    await db.destroy();
  });

  it.each([
    "missing-account",
    "inactive",
    "role",
    "generation",
    "missing-setting",
    "expired-setting",
    "missing-challenge",
    "purpose",
    "consumed",
    "valid",
  ])("validates MFA activation against %s state", async (mode) => {
    const entity = UserEntity.create();
    entity.pullDomainEvents();
    entity.invalidateSessions();
    const row = {
      ...account,
      id: entity.identifier.value,
      ...(mode === "inactive" ? { status: "suspended" } : {}),
      ...(mode === "role" ? { role: "admin" } : {}),
      ...(mode === "generation" ? { session_version: 3 } : {}),
    };
    const { db } = database({
      iam_users: mode === "missing-account" ? undefined : row,
      iam_mfa_settings:
        mode === "missing-setting"
          ? undefined
          : {
              ...setting,
              enabled_at: null,
              ...(mode === "expired-setting"
                ? { enrollment_expires_at: new Date(0) }
                : {}),
            },
      iam_mfa_challenges:
        mode === "missing-challenge"
          ? undefined
          : {
              ...challenge,
              purpose:
                mode === "purpose" ? "signin" : "enrollment_confirmation",
              ...(mode === "consumed" ? { consumed_at: now } : {}),
            },
    });
    const adapter = new KyselyMfaAdapter(db, () => ({
      append: () => Promise.resolve(),
    }));
    expect(
      await adapter.activate({
        user: entity,
        confirmationId: "confirmation",
        now,
      }),
    ).toBe(mode === "valid");
    await db.destroy();
  });

  it.each([
    undefined,
    { ...account, status: "suspended" },
    { ...account, session_version: 2 },
    account,
  ])("binds new challenges to the locked account generation", async (row) => {
    const { db } = database({ iam_users: row, iam_mfa_challenges: challenge });
    const adapter = new KyselyMfaAdapter(db, () => ({
      append: () => Promise.resolve(),
    }));
    const result = await adapter.beginChallenge({
      userId: "account",
      userSessionVersion: 1,
      id: "challenge",
      now,
      expiresAt: challenge.expires_at,
      maximumAttempts: 3,
    });
    expect(result?.id ?? null).toBe(row === account ? "challenge" : null);
    await db.destroy();
  });

  it.each([
    "missing-account",
    "inactive",
    "missing-setting",
    "disabled",
    "valid",
  ])("guards backup-code replacement against %s state", async (mode) => {
    const { db } = database({
      iam_users:
        mode === "missing-account"
          ? undefined
          : {
              ...account,
              status: mode === "inactive" ? "suspended" : "active",
            },
      iam_mfa_settings:
        mode === "missing-setting"
          ? undefined
          : { ...setting, enabled_at: mode === "disabled" ? null : now },
    });
    const adapter = new KyselyMfaAdapter(db, () => ({
      append: () => Promise.resolve(),
    }));
    expect(
      await adapter.replaceBackupCodes("account", ["backup-hash"], now),
    ).toBe(mode === "valid");
    await db.destroy();
  });
  it.each(["totp", "backup_code", "replay", "expired-counter"] as const)(
    "preserves %s consumption and statement order",
    async (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      try {
        const { db, statements } = database(
          {
            iam_users: account,
            iam_mfa_settings: {
              ...setting,
              last_totp_counter: mode === "replay" ? String(counter) : null,
            },
            iam_mfa_challenges: challenge,
          },
          mode === "backup_code" ? 1 : 0,
        );
        const append = vi.fn(() => Promise.resolve());
        const adapter = new KyselyMfaAdapter(db, () => ({ append }));
        const result = await adapter.verify({
          userId: "account",
          sealedSecret: "sealed",
          counter:
            mode === "backup_code"
              ? null
              : counter - (mode === "expired-counter" ? 3 : 0),
          backupHash: "backup-hash",
          challengeId: "challenge",
          now,
        });
        expect(result).toBe(
          mode === "replay" || mode === "expired-counter" ? null : mode,
        );
        const updates = statements.filter((sql) => sql.startsWith("update"));
        expect(updates[0]).toContain('"iam_mfa_challenges"');
        expect(updates[1]).toContain(
          mode === "totp" ? '"iam_mfa_settings"' : '"iam_mfa_backup_codes"',
        );
        expect(append).toHaveBeenCalledTimes(mode === "backup_code" ? 1 : 0);
        expect(statements.at(-1)).toBe("commit");
        await db.destroy();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each([
    { iam_users: undefined },
    { iam_users: { ...account, status: "suspended" } },
    { iam_mfa_settings: undefined },
    { iam_mfa_settings: { ...setting, enabled_at: null } },
    { iam_mfa_settings: { ...setting, encrypted_secret: "changed" } },
    { iam_mfa_challenges: undefined },
    {
      iam_mfa_challenges: { ...challenge, purpose: "enrollment_confirmation" },
    },
    { iam_mfa_challenges: { ...challenge, user_session_version: 2 } },
    { iam_mfa_challenges: { ...challenge, consumed_at: now } },
  ])(
    "refuses stale or missing authentication state before proof consumption",
    async (overrides) => {
      const { db, statements } = database({
        iam_users: account,
        iam_mfa_settings: setting,
        iam_mfa_challenges: challenge,
        ...overrides,
      });
      const append = vi.fn(() => Promise.resolve());
      const adapter = new KyselyMfaAdapter(db, () => ({ append }));
      expect(
        await adapter.verify({
          userId: "account",
          sealedSecret: "sealed",
          counter,
          backupHash: "backup-hash",
          challengeId: "challenge",
          now,
        }),
      ).toBeNull();
      expect(statements.some((sql) => sql.startsWith("update"))).toBe(false);
      expect(append).not.toHaveBeenCalled();
      await db.destroy();
    },
  );
});

describe("account and configuration transaction guards", () => {
  it("does not cancel when a locked deletion update no longer matches", async () => {
    const { db } = database({
      iam_users: { ...account, status: "pending_deletion", session_version: 2 },
    });
    const adapter = new KyselyAccountDeletionAdapter(db, () => ({
      append: () => Promise.resolve(),
    }));
    expect(
      await adapter.cancel({ user, requestId: "request", now } as never),
    ).toBe(false);
    await db.destroy();
  });
  it.each([undefined, { ...account, status: "suspended" }])(
    "refuses export reservation for an unavailable account",
    async (row) => {
      const { db, statements } = database({ iam_users: row });
      const adapter = new KyselyAccountExportAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(await adapter.reserve("account", "export", now)).toBeNull();
      expect(statements.some((sql) => sql.startsWith("insert"))).toBe(false);
      await db.destroy();
    },
  );

  it.each([
    undefined,
    { ...account, session_version: 0 },
    { ...account, status: "suspended" },
    { ...account, role: "admin" },
  ])(
    "refuses mismatched deletion generations, status and role",
    async (row) => {
      const { db } = database({ iam_users: row });
      const adapter = new KyselyAccountDeletionAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(
        await adapter.request({ user, previousStatus: "active" } as never),
      ).toBe("conflict");
      expect(await adapter.cancel({ user } as never)).toBe(false);
      await db.destroy();
    },
  );

  it.each([undefined, { ...account, status: "active" }])(
    "does not erase an account outside pending deletion",
    async (row) => {
      const { db } = database({
        iam_users: row,
        iam_account_deletions: { user_id: "account" },
      });
      const adapter = new KyselyAccountDeletionAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(await adapter.eraseIfDue("deletion", now)).toBeNull();
      await db.destroy();
    },
  );

  it.each([
    undefined,
    account,
    { ...account, role: "admin", status: "suspended" },
  ])(
    "refuses publication by a missing or inactive administrator",
    async (row) => {
      const { db } = database({
        iam_users: row,
        iam_security_config_revisions: { version: 1 },
      });
      const adapter = new KyselySecurityConfigurationAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(
        await adapter.publish({
          expectedVersion: 1,
          actorId: "account",
        } as never),
      ).toBe("unauthorized");
      await db.destroy();
    },
  );

  it("keeps forbidden rollbacks asynchronous and rejected", async () => {
    const { db } = database({});
    for (const migrations of [
      iamAuthenticationProofMigrations,
      iamConfigurationVersionMigrations,
    ]) {
      const migration = Object.values(migrations)[0];
      expect(migration?.down).toBeDefined();
      const result = migration?.down?.(db);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow(/forward migration/);
    }
    await db.destroy();
  });
});
