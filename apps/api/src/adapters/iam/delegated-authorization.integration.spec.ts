import { randomUUID } from "node:crypto";

import {
  DelegatedAuthorization,
  type DelegatedCredentialAuthority,
} from "@architecture/iam/application";
import {
  AuthorizationGrant,
  ClientApplication,
  type ProtectedResource,
} from "@architecture/iam/domain";
import {
  type IamDatabase,
  KyselyDelegatedAuthorizationAdapter,
} from "@architecture/iam-persistence-kysely";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Migrator } from "kysely/migration";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAllMigrations } from "#app/scripts/migrations.provider";

const databaseUrl = process.env["IAM_INTEGRATION_DATABASE_URL"];
const resource: ProtectedResource = {
  id: "synthetic-account",
  uri: "https://resource.example.test/account",
  permissions: [
    { code: "read", description: "Read" },
    { code: "write", description: "Write" },
  ],
};

function unwrap<T>(
  result:
    { success: true; value: T } | { success: false; error: { code: string } },
): T {
  if (!result.success) {
    throw new Error(result.error.code);
  }
  return result.value;
}

describe.skipIf(!databaseUrl)(
  "delegated authorization PostgreSQL boundaries",
  () => {
    const authority = new DelegatedAuthorization([resource]);
    const schema = `delegated_test_${randomUUID().replaceAll("-", "")}`;
    let database: Kysely<IamDatabase>;
    let admin: Pool;
    let store: KyselyDelegatedAuthorizationAdapter;

    beforeAll(async () => {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema ${schema}`);
      database = new Kysely({
        dialect: new PostgresDialect({
          pool: new Pool({
            connectionString: databaseUrl,
            options: `-c search_path=${schema} -c statement_timeout=5000`,
          }),
        }),
      });
      const migrator = new Migrator({
        db: database,
        migrationTableSchema: schema,
        provider: { getMigrations: async () => getAllMigrations() },
      });
      const { error } = await migrator.migrateToLatest();
      if (error) {
        throw error;
      }
      store = new KyselyDelegatedAuthorizationAdapter(database);
    });

    afterAll(async () => {
      await database?.destroy();
      if (admin) {
        await admin.query(`drop schema if exists ${schema} cascade`);
        await admin.end();
      }
    });

    async function fixture() {
      const accountId = randomUUID();
      const otherAccountId = randomUUID();
      const now = new Date();
      await database
        .insertInto("iam_users")
        .values(
          [accountId, otherAccountId].map((id) => ({
            id,
            role: "user",
            status: "active",
            session_version: 1,
            created_at: now,
            updated_at: now,
          })),
        )
        .execute();
      const client = unwrap(
        ClientApplication.register(randomUUID(), "Synthetic client"),
      );
      await store.write(null, (writer) => writer.saveClient(client));
      const enabled = ClientApplication.rehydrate({
        ...client.state,
        enabled: true,
        revision: 1,
        policies: [
          { resourceId: resource.id, required: ["read"], optional: ["write"] },
        ],
      });
      await store.write(null, (writer) => writer.saveClient(enabled));
      const request = {
        accountId,
        clientId: client.state.id,
        resourceId: resource.id,
        clientRevision: 1,
        requested: ["read", "write"],
      };
      return { accountId, otherAccountId, request, enabled };
    }

    function prepare(request: Awaited<ReturnType<typeof fixture>>["request"]) {
      return store.read(async (reader) =>
        unwrap(await authority.prepare(reader, request)),
      );
    }

    function finalize(
      consent: Awaited<ReturnType<typeof prepare>>,
      selected: string[],
    ) {
      return store.write(consent.accountId, (writer) =>
        authority.finalize(writer, {
          consent,
          selected,
          sessionIsCurrent: async () => true,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );
    }

    function admit(
      credential: DelegatedCredentialAuthority,
      permission: string,
      resourceId = resource.id,
    ) {
      return store.read((reader) =>
        authority.admit(reader, {
          credential,
          permission,
          intendedResourceId: resourceId,
          scope: [permission],
        }),
      );
    }

    it("commits one lifecycle across concurrent consent and refuses cross-account and cross-resource use", async () => {
      const { accountId, otherAccountId, request } = await fixture();
      const [first, second] = await Promise.all([
        prepare(request),
        prepare(request),
      ]);
      const [readOnly, both] = (
        await Promise.all([
          finalize(first, ["read"]),
          finalize(second, ["read", "write"]),
        ])
      ).map(unwrap);
      if (!readOnly || !both) {
        throw new Error("Expected two confirmed decisions");
      }
      expect(readOnly.grantId).toBe(both.grantId);
      expect(readOnly.entitlements.map(({ code }) => code)).toEqual(["read"]);
      expect((await admit(readOnly, "write")).success).toBe(false);
      expect(await admit(both, "write")).toEqual({
        success: true,
        value: { accountId },
      });
      expect(
        (await admit({ ...both, accountId: otherAccountId }, "read")).success,
      ).toBe(false);
      expect((await admit(both, "read", "another-resource")).success).toBe(
        false,
      );
      await expect(
        store.read((reader) => reader.grants(otherAccountId)),
      ).resolves.toEqual([]);
      await expect(
        store.write(accountId, (writer) =>
          writer.saveGrant(
            AuthorizationGrant.authorize(request, ["read"], new Date()),
          ),
        ),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "iam_delegated_active_grant",
      });
    });

    it("rejects stale consent, preserves read after optional withdrawal and never restores old write", async () => {
      const { accountId, request } = await fixture();
      const first = unwrap(
        await finalize(await prepare(request), ["read", "write"]),
      );
      const stale = await prepare(request);
      await store.write(accountId, async (writer) => {
        const grant = await writer.grant(accountId, first.grantId);
        if (!grant) {
          throw new Error("Missing initial grant");
        }
        await writer.saveGrant(grant.withdraw("write", ["read"], new Date()));
        await writer.invalidateConsent(grant.state);
      });
      expect(await finalize(stale, ["read", "write"])).toMatchObject({
        success: false,
        error: { code: "delegated_authorization.stale_consent" },
      });
      const fresh = unwrap(
        await finalize(await prepare(request), ["read", "write"]),
      );
      expect(first.grantId).toBe(fresh.grantId);
      expect((await admit(first, "read")).success).toBe(true);
      expect((await admit(first, "write")).success).toBe(false);
      expect((await admit(fresh, "write")).success).toBe(true);

      await store.write(accountId, async (writer) => {
        const grant = await writer.grant(accountId, first.grantId);
        if (!grant) {
          throw new Error("Missing extended grant");
        }
        await writer.saveGrant(grant.withdraw("read", ["read"], new Date()));
        await writer.invalidateConsent(grant.state);
      });
      const replacement = unwrap(
        await finalize(await prepare(request), ["read"]),
      );
      expect(replacement.grantId).not.toBe(first.grantId);
      expect((await admit(fresh, "read")).success).toBe(false);
      expect((await admit(replacement, "read")).success).toBe(true);
    });

    it("rejects failed session, expired consent, account epoch change and stale client revision", async () => {
      const { accountId, request, enabled } = await fixture();
      const consent = await prepare(request);
      const input = {
        consent,
        selected: ["read"],
        expiresAt: new Date(Date.now() + 60_000),
      };
      const attempt = (override: {
        expiresAt?: Date;
        sessionIsCurrent?: () => Promise<boolean>;
      }) =>
        store.write(accountId, (writer) =>
          authority.finalize(writer, {
            ...input,
            sessionIsCurrent: async () => true,
            ...override,
          }),
        );
      expect(
        (await attempt({ sessionIsCurrent: async () => false })).success,
      ).toBe(false);
      expect((await attempt({ expiresAt: new Date(0) })).success).toBe(false);
      expect((await finalize(consent, ["write"])).success).toBe(false);
      await database
        .insertInto("iam_delegated_account_epochs")
        .values({ account_id: accountId, epoch: "1" })
        .execute();
      expect((await attempt({})).success).toBe(false);
      const afterEpoch = await prepare(request);
      await store.write(null, (writer) =>
        writer.saveClient(
          ClientApplication.rehydrate({ ...enabled.state, revision: 2 }),
        ),
      );
      expect((await finalize(afterEpoch, ["read"])).success).toBe(false);
      await expect(
        store.read((reader) => reader.grants(accountId)),
      ).resolves.toEqual([]);
    });

    it("rolls back consent if a subsequent write in the same transaction fails", async () => {
      const { accountId, request } = await fixture();
      const consent = await prepare(request);
      await expect(
        store.write(accountId, async (writer) => {
          unwrap(
            await authority.finalize(writer, {
              consent,
              selected: ["read"],
              sessionIsCurrent: async () => true,
              expiresAt: new Date(Date.now() + 60_000),
            }),
          );
          // Force a real PostgreSQL uniqueness failure after the grant write.
          await writer.saveGrant(
            AuthorizationGrant.authorize(request, ["read"], new Date()),
          );
        }),
      ).rejects.toMatchObject({ code: "23505" });
      await expect(
        store.read((reader) => reader.grants(accountId)),
      ).resolves.toEqual([]);
    });

    it("orders new admission behind an exclusive in-flight revocation", async () => {
      const { accountId, request } = await fixture();
      const credential = unwrap(
        await finalize(await prepare(request), ["read"]),
      );
      const release = Promise.withResolvers<undefined>();
      const updated = Promise.withResolvers<undefined>();
      const revocation = store.write(accountId, async (writer) => {
        const grant = await writer.grant(accountId, credential.grantId);
        if (!grant) {
          throw new Error("Missing active grant");
        }
        await writer.saveGrant(grant.revoke(new Date()));
        await writer.invalidateConsent(grant.state);
        updated.resolve(undefined);
        await release.promise;
      });
      try {
        await Promise.race([revocation, updated.promise]);
        const admission = admit(credential, "read");
        await expect
          .poll(
            async () => {
              const waiting = await sql<{ waiting: boolean }>`select exists (
          select 1 from pg_locks where locktype = 'advisory' and not granted and objid = 728194002
        ) as waiting`.execute(database);
              return waiting.rows[0]?.waiting;
            },
            { timeout: 2000, interval: 20 },
          )
          .toBe(true);
        release.resolve(undefined);
        await revocation;
        expect((await admission).success).toBe(false);
      } finally {
        release.resolve(undefined);
        await revocation;
      }
    });
  },
);
