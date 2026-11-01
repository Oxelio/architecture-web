import { Kysely, PostgresDialect, type PostgresPoolClient } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { IamDatabase } from "#persistence/schema";

import { iamAuthenticationProofMigrations } from "../persistence/migrations/007_bind_authentication_proofs.js";
import { iamConfigurationVersionMigrations } from "../persistence/migrations/008_version_configuration.js";
import { KyselyAccountDeletionAdapter } from "./kysely-account-deletion.adapter.js";
import { KyselyAccountExportAdapter } from "./kysely-account-export.adapter.js";
import { KyselyMfaAdapter } from "./kysely-mfa.adapter.js";
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

describe("transactional MFA proof consumption", () => {
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
      const beforeErase = vi.fn();
      const adapter = new KyselyAccountDeletionAdapter(db, () => ({
        append: () => Promise.resolve(),
      }));
      expect(await adapter.eraseIfDue("deletion", now, beforeErase)).toBeNull();
      expect(beforeErase).not.toHaveBeenCalled();
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
