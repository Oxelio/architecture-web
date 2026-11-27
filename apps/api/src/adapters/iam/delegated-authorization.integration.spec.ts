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
import {
  KyselyOutboxWriterAdapter,
  type MessagingDatabase,
} from "@architecture/messaging-persistence-kysely";
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
    let database: Kysely<IamDatabase & MessagingDatabase>;
    let admin: Pool;
    let store: KyselyDelegatedAuthorizationAdapter;
    const outbox = (db: Kysely<IamDatabase>) =>
      new KyselyOutboxWriterAdapter(
        db
          .$extendTables<{
            messaging_outbox: MessagingDatabase["messaging_outbox"];
          }>()
          .$pickTables<keyof MessagingDatabase>(),
      );

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
      store = new KyselyDelegatedAuthorizationAdapter(
        database.$pickTables<keyof IamDatabase>(),
        outbox,
      );
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
      await store.write(null, (writer) => writer.saveClient(client, accountId));
      const enabled = ClientApplication.rehydrate({
        ...client.state,
        enabled: true,
        revision: 1,
        policies: [
          { resourceId: resource.id, required: ["read"], optional: ["write"] },
        ],
      });
      await store.write(null, (writer) =>
        writer.saveClient(enabled, accountId),
      );
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
        await writer.saveGrantRestriction(
          grant.withdraw("write", ["read"], new Date()),
          { permission: "write" },
        );
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
        await writer.saveGrantRestriction(
          grant.withdraw("read", ["read"], new Date()),
          { permission: "read" },
        );
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
      await store.write(accountId, (writer) =>
        writer.revokeAccountGrants(accountId),
      );
      expect(
        await database
          .selectFrom("messaging_outbox")
          .select("id")
          .where("aggregate_id", "=", accountId)
          .execute(),
      ).toEqual([]);
      expect((await attempt({})).success).toBe(false);
      const afterEpoch = await prepare(request);
      await store.write(null, (writer) =>
        writer.saveClient(
          ClientApplication.rehydrate({ ...enabled.state, revision: 2 }),
          accountId,
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
      const displayed = await prepare(request);
      const release = Promise.withResolvers<undefined>();
      const updated = Promise.withResolvers<undefined>();
      const revocation = store.write(accountId, async (writer) => {
        const grant = await writer.grant(accountId, credential.grantId);
        if (!grant) {
          throw new Error("Missing active grant");
        }
        await writer.saveGrantRestriction(
          grant.revoke(new Date()),
          "revocation",
        );
        updated.resolve(undefined);
        await release.promise;
      });
      try {
        await Promise.race([revocation, updated.promise]);
        const admission = admit(credential, "read");
        const consent = finalize(displayed, ["read"]);
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
        expect(await consent).toMatchObject({
          success: false,
          error: { code: "delegated_authorization.stale_consent" },
        });
      } finally {
        release.resolve(undefined);
        await revocation;
      }
    });

    it("removes policy-withdrawn generations, preserves other grants and revokes only newly noncompliant grants", async () => {
      const { accountId, otherAccountId, request, enabled } = await fixture();
      const original = unwrap(
        await finalize(await prepare(request), ["read", "write"]),
      );
      const other = unwrap(
        await finalize(
          await prepare({ ...request, accountId: otherAccountId }),
          ["read"],
        ),
      );
      const setPolicy = (
        revision: number,
        required: string[],
        optional: string[],
      ) =>
        store.write(null, (writer) =>
          writer.saveClient(
            ClientApplication.rehydrate({
              ...enabled.state,
              revision,
              policies: [{ resourceId: resource.id, required, optional }],
            }),
            accountId,
          ),
        );
      await setPolicy(2, ["read"], []);
      expect((await admit(original, "read")).success).toBe(true);
      expect((await admit(original, "write")).success).toBe(false);
      const withdrawal = await database
        .selectFrom("messaging_outbox")
        .select("payload")
        .where("aggregate_id", "=", original.grantId)
        .executeTakeFirstOrThrow();
      expect(withdrawal.payload).toMatchObject({
        permissions: ["write"],
        userId: accountId,
      });
      await setPolicy(3, ["read"], ["write"]);
      expect((await admit(original, "write")).success).toBe(false);
      const fresh = unwrap(
        await finalize(await prepare({ ...request, clientRevision: 3 }), [
          "read",
          "write",
        ]),
      );
      expect(fresh.grantId).toBe(original.grantId);
      expect((await admit(fresh, "write")).success).toBe(true);

      await setPolicy(4, ["read", "write"], []);
      expect((await admit(fresh, "read")).success).toBe(true);
      await setPolicy(5, ["read"], ["write"]);
      expect((await admit(other, "read")).success).toBe(false);
      const revoked = await database
        .selectFrom("messaging_outbox")
        .select("payload")
        .where("topic", "=", "iam.delegated-grants-revoked")
        .where("aggregate_id", "=", otherAccountId)
        .execute();
      expect(revoked).toEqual([
        {
          payload: expect.objectContaining({
            reason: "client_policy_changed",
            affectedGrantCount: 1,
          }),
        },
      ]);
    });

    it.each([1000, 10000])(
      "atomically disables a client across %i accounts with grouped durable facts",
      async (accounts) => {
        const { accountId, enabled } = await fixture();
        const unrelated = await fixture();
        const retained = unwrap(
          await finalize(await prepare(unrelated.request), ["read"]),
        );
        await sql`
        with seeded as (
          insert into iam_users (id, role, status, session_version, created_at, updated_at)
          select uuidv7(), 'user', 'active', 1, now(), now() from generate_series(1, ${accounts}) returning id
        )
        insert into iam_delegated_grants (id, account_id, client_id, resource_id, authorized_at, permissions)
        select uuidv7(), seeded.id, ${enabled.state.id}, 'synthetic-' || resource.number, now(),
          jsonb_build_array(jsonb_build_object('code', 'read', 'generation', uuidv7()))
        from seeded cross join generate_series(1, 3) as resource(number)
      `.execute(database);
        const change = (
          adapter: KyselyDelegatedAuthorizationAdapter,
          revision: number,
          enabledState: boolean,
        ) =>
          adapter.write(null, (writer) =>
            writer.saveClient(
              ClientApplication.rehydrate({
                ...enabled.state,
                revision,
                enabled: enabledState,
              }),
              accountId,
            ),
          );
        const remaining = () =>
          database
            .selectFrom("iam_delegated_grants")
            .select(({ fn }) => fn.countAll().as("count"))
            .where("client_id", "=", enabled.state.id)
            .where("revoked_at", "is", null)
            .executeTakeFirstOrThrow();
        const counts = async () =>
          (
            await sql<{
              facts: number;
              subjects: number;
              operations: number;
              grants: number;
            }>`
        select count(*)::int as facts, count(distinct aggregate_id)::int as subjects,
          count(distinct payload->>'operationId')::int as operations,
          coalesce(sum((payload->>'affectedGrantCount')::int), 0)::int as grants
        from messaging_outbox where topic = 'iam.delegated-grants-revoked' and payload->>'clientId' = ${enabled.state.id}
      `.execute(database)
          ).rows[0];
        if (accounts === 1000) {
          let batches = 0;
          const failure = new Error(
            "failure after two transaction-bound outbox writes",
          );
          const failingStore = new KyselyDelegatedAuthorizationAdapter(
            database.$pickTables<keyof IamDatabase>(),
            (db) => ({
              append: async (events) => {
                await outbox(db).append(events);
                if (++batches === 2) {
                  throw failure;
                }
              },
            }),
          );
          await expect(change(failingStore, 2, false)).rejects.toBe(failure);
          expect(Number((await remaining()).count)).toBe(accounts * 3);
          expect(await counts()).toEqual({
            facts: 0,
            subjects: 0,
            operations: 0,
            grants: 0,
          });
        }
        const start = performance.now();
        await change(store, 2, false);
        const elapsed = Math.round(performance.now() - start);
        expect(Number((await remaining()).count)).toBe(0);
        expect(await counts()).toEqual({
          facts: accounts,
          subjects: accounts,
          operations: 1,
          grants: accounts * 3,
        });
        await change(store, 3, false);
        await change(store, 4, true);
        expect(Number((await remaining()).count)).toBe(0);
        expect(await counts()).toEqual({
          facts: accounts,
          subjects: accounts,
          operations: 1,
          grants: accounts * 3,
        });
        expect((await admit(retained, "read")).success).toBe(true);
        console.info(
          `Delegated client disablement: ${accounts} accounts, ${accounts * 3} grants, ${elapsed} ms`,
        );
      },
      30000,
    );
  },
);
