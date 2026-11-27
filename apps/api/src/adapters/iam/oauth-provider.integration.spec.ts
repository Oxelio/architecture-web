import { type ChildProcess, fork } from "node:child_process";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import {
  ClientApplication,
  type ProtectedResource,
  SessionEntity,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import {
  type IamDatabase,
  KyselyDelegatedAuthorizationAdapter,
} from "@architecture/iam-persistence-kysely";
import { RedisSessionAdapter } from "@architecture/iam-session-redis";
import {
  KyselyOutboxWriterAdapter,
  type MessagingDatabase,
} from "@architecture/messaging-persistence-kysely";
import fastify, { type FastifyInstance } from "fastify";
import { Redis } from "ioredis";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Migrator } from "kysely/migration";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { authPlugin } from "#app/auth";
import { getAllMigrations } from "#app/scripts/migrations.provider";
import type { OAuthOptions } from "#config/oauth.config";

import { buildOAuthRoutes } from "./oauth.routes.js";
import { createOAuthProvider, type OAuthProvider } from "./oauth-provider.js";

const databaseUrl = process.env["IAM_INTEGRATION_DATABASE_URL"];
const redisUrl = process.env["IAM_INTEGRATION_REDIS_URL"];
const issuer = "http://127.0.0.1";
const redirect = "https://client.example.test/callback";
const resource: ProtectedResource = {
  id: "synthetic-account",
  uri: "https://resource.example.test/account",
  permissions: [
    { code: "read", description: "Read" },
    { code: "write", description: "Write" },
  ],
};
const signingKey = generateKeyPairSync("ec", {
  namedCurve: "P-256",
}).privateKey.export({ format: "jwk" });
const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

describe.skipIf(!databaseUrl || !redisUrl)(
  "Fastify OAuth with PostgreSQL and Redis",
  () => {
    const name = `iam_refactor_test_oauth_${randomUUID().replaceAll("-", "")}`;
    let admin: Pool;
    let db: Kysely<IamDatabase & MessagingDatabase>;
    let redis: Redis;
    let sessions: RedisSessionAdapter;
    let store: KyselyDelegatedAuthorizationAdapter;
    let runtime: Awaited<ReturnType<typeof start>>;
    const hosts: FastifyInstance[] = [];
    const peers: ChildProcess[] = [];
    let peerInputs: { database: string; redis: string };
    const keys: OAuthOptions = {
      issuer,
      cookieKeys: [randomBytes(32).toString("base64url")],
      artifactKeys: [randomBytes(32)],
      bindingKeys: [randomBytes(32)],
      jwks: {
        keys: [
          {
            ...signingKey,
            kid: "oauth-test",
            use: "sig",
            alg: "ES256",
            kty: "EC",
          },
        ],
      },
      trustProxy: false,
    };

    async function start(options: OAuthOptions) {
      const oauth = createOAuthProvider(options, store, sessions, [resource]);
      const app = fastify({ logger: false });
      hosts.push(app);
      await app.register(authPlugin, {
        resolveSession: {
          execute: async () => ({
            success: false,
            error: { code: "session.unauthorized" },
          }),
        },
        sessionCookieName: "sid",
      });
      await app.register(buildOAuthRoutes(oauth));
      const address = await app.listen({ port: 0, host: "127.0.0.1" });
      return { oauth, address };
    }

    async function startPeer() {
      const peer = fork(
        new URL("./oauth-process-fixture.ts", import.meta.url),
        [],
        {
          execArgv: ["--import", "tsx"],
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          serialization: "advanced",
        },
      );
      peers.push(peer);
      peer.send({ ...peerInputs, options: keys, resources: [resource] });
      const address = await Promise.race([
        once(peer, "message").then(([message]: unknown[]) =>
          z.string().url().parse(message),
        ),
        once(peer, "exit").then(() => {
          throw new Error("OAuth fixture process stopped during startup");
        }),
      ]);
      return address;
    }

    beforeAll(async () => {
      if (!databaseUrl || !redisUrl) {
        throw new Error("OAuth integration fixtures are required");
      }
      const isolated = new URL(databaseUrl);
      if (!isolated.pathname.startsWith("/iam_refactor_test")) {
        throw new Error("Expected disposable IAM test database");
      }
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create database "${name}"`);
      isolated.pathname = `/${name}`;
      peerInputs = { database: isolated.href, redis: redisUrl };
      db = new Kysely({
        dialect: new PostgresDialect({
          pool: new Pool({ connectionString: isolated.href }),
        }),
      });
      const migrated = await new Migrator({
        db,
        provider: { getMigrations: async () => getAllMigrations() },
      }).migrateToLatest();
      if (migrated.error) {
        throw migrated.error;
      }
      await sql`create table oauth_test_guard (account uuid references iam_users(id) deferrable initially deferred)`.execute(
        db,
      );
      await sql`create function oauth_test_reject() returns trigger language plpgsql as $$
        begin
          if exists (select 1 from oauth_test_faults where model = NEW.model) then
            insert into oauth_test_guard values ('00000000-0000-0000-0000-000000000000');
          end if;
          if NEW.model = 'AccessToken' and exists (select 1 from oauth_test_faults where model = 'Disconnect') then
            perform pg_advisory_xact_lock(7210446);
          end if;
          return NEW;
        end
      $$`.execute(db);
      await sql`create table oauth_test_faults (model text primary key)`.execute(
        db,
      );
      await sql`create trigger oauth_test_commit_failure after insert on iam_oauth_artifacts
      for each row execute function oauth_test_reject()`.execute(db);
      redis = new Redis(redisUrl);
      sessions = new RedisSessionAdapter(redis);
      store = new KyselyDelegatedAuthorizationAdapter(
        db.$pickTables<keyof IamDatabase>(),
        (transaction) =>
          new KyselyOutboxWriterAdapter(
            transaction
              .$extendTables<{
                messaging_outbox: MessagingDatabase["messaging_outbox"];
              }>()
              .$pickTables<keyof MessagingDatabase>(),
          ),
      );
      runtime = await start(keys);
    });

    afterAll(async () => {
      await Promise.all(
        peers.map(async (peer) => {
          if (peer.exitCode === null && peer.signalCode === null) {
            const exited = once(peer, "exit");
            peer.disconnect();
            await exited;
          }
        }),
      );
      await Promise.all(hosts.map((host) => host.close()));
      redis?.disconnect();
      await db?.destroy();
      if (admin) {
        await admin.query(`drop database if exists "${name}"`);
        await admin.end();
      }
    });

    async function fixture() {
      const userId = UserIdentifierValueObject.generate();
      const accountId = userId.value;
      const created = ClientApplication.register(
        randomUUID(),
        "Synthetic client",
      );
      if (!created.success) {
        throw new Error("Test client registration failed");
      }
      const now = new Date();
      await db
        .insertInto("iam_users")
        .values({
          id: accountId,
          role: "user",
          status: "active",
          session_version: 1,
          created_at: now,
          updated_at: now,
        })
        .execute();
      await store.write(null, (writer) =>
        writer.saveClient(created.value, accountId),
      );
      const client = ClientApplication.rehydrate({
        ...created.value.state,
        enabled: true,
        revision: 1,
        redirectUris: [redirect],
        policies: [
          { resourceId: resource.id, required: ["read"], optional: ["write"] },
        ],
      });
      await store.write(null, (writer) => writer.saveClient(client, accountId));
      async function newSession() {
        const session = SessionEntity.createForUser({
          userId,
          userSessionVersion: 1,
          expiresAt: new Date(Date.now() + 60_000),
        });
        await sessions.save(session);
        return session.identifier;
      }
      return { accountId, client, sid: await newSession(), newSession };
    }

    function browser(sid?: string) {
      const cookies = new Map<string, string>();
      if (sid) {
        cookies.set("sid", sid);
      }
      return {
        cookies,
        async request(location: string, body?: object, origin = issuer) {
          const url = new URL(location, issuer);
          const response = await fetch(
            runtime.address + url.pathname + url.search,
            {
              redirect: "manual",
              method: body ? "POST" : "GET",
              headers: {
                cookie: [...cookies]
                  .map(([key, value]) => `${key}=${value}`)
                  .join("; "),
                ...(body ? { "content-type": "application/json", origin } : {}),
              },
              ...(body ? { body: JSON.stringify(body) } : {}),
            },
          );
          for (const raw of response.headers.getSetCookie()) {
            const pair = raw.split(";")[0];
            if (!pair) {
              continue;
            }
            const index = pair.indexOf("=");
            cookies.set(pair.slice(0, index), pair.slice(index + 1));
          }
          return response;
        },
      };
    }

    const location = (response: Response) =>
      response.headers.get("location") ?? "";
    function authorization(clientId: string) {
      return (
        "/auth?" +
        new URLSearchParams({
          client_id: clientId,
          response_type: "code",
          redirect_uri: redirect,
          scope: "read write",
          resource: resource.uri,
          code_challenge: challenge,
          code_challenge_method: "S256",
          state: "test-state",
        })
      );
    }

    async function prompt(clientId: string, user: ReturnType<typeof browser>) {
      const first = await user.request(authorization(clientId));
      expect(first.status).toBe(303);
      expect(location(first)).toMatch(/^\/oauth\/consent\//u);
      const login = await user.request(location(first), { confirm: true });
      expect(login.status).toBe(303);
      const resume = await user.request(location(login));
      expect(resume.status).toBe(303);
      expect(location(resume)).toMatch(/^\/oauth\/consent\//u);
      return location(resume);
    }

    async function approve(
      user: ReturnType<typeof browser>,
      path: string,
      selected = ["read", "write"],
    ) {
      const accepted = await user.request(path, { selected });
      expect(accepted.status).toBe(303);
      const resume = await user.request(location(accepted));
      expect(resume.status).toBe(303);
      const url = new URL(location(resume));
      expect(url.searchParams.get("state")).toBe("test-state");
      const code = url.searchParams.get("code");
      expect(typeof code).toBe("string");
      return code ?? "";
    }

    function token(data: Record<string, string>, address = runtime.address) {
      return fetch(address + "/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ resource: resource.uri, ...data }),
      });
    }

    function exchange(clientId: string, code: string, target = redirect) {
      return token({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        ...(target ? { redirect_uri: target } : {}),
      });
    }

    async function tokens(response: Response): Promise<{
      access_token: string;
      refresh_token: string;
      scope: string;
      expires_in: number;
    }> {
      expect(response.status).toBe(200);
      return z
        .object({
          access_token: z.string(),
          refresh_token: z.string(),
          scope: z.string(),
          expires_in: z.number(),
        })
        .parse(await response.json());
    }

    function admit(
      oauth: OAuthProvider,
      tokenValue: string,
      permission: string,
    ) {
      return oauth.admit({
        token: tokenValue,
        resourceId: resource.id,
        permission,
      });
    }

    it("validates discovery, admission, authorization inputs and browser session binding", async () => {
      const { sid, client, newSession } = await fixture();
      const user = browser();
      expect(
        (await user.request("/.well-known/openid-configuration")).status,
      ).toBe(404);
      expect(
        (await user.request("/.well-known/oauth-authorization-server")).status,
      ).toBe(200);
      expect(
        (
          await user.request(
            authorization(client.state.publicId) +
              "&resource=https://other.example.test",
          )
        ).status,
      ).toBe(400);
      const initial = await user.request(authorization(client.state.publicId));
      const loginPath = location(initial);
      expect(location(await user.request(loginPath))).toMatch(
        /^\/signin\?continue=/u,
      );
      user.cookies.set("sid", sid.value);
      expect(
        (
          await user.request(
            loginPath,
            { confirm: true },
            "https://other.example.test",
          )
        ).status,
      ).toBe(403);
      const login = await user.request(loginPath, { confirm: true });
      const resumed = await user.request(location(login));
      expect(resumed.status).toBe(303);
      const consentPath = location(resumed);
      const consent = await user.request(consentPath);
      expect(await consent.json()).toMatchObject({
        phase: "consent",
        resourceUri: resource.uri,
      });
      user.cookies.set("sid", (await newSession()).value);
      expect(
        (await user.request(consentPath, { selected: ["read"] })).status,
      ).toBe(403);
      user.cookies.set("sid", sid.value);
      const code = await approve(user, consentPath, ["read"]);
      expect(
        (await user.request(consentPath, { selected: ["read"] })).status,
      ).toBe(403);
      expect((await exchange(client.state.publicId, code, "")).status).toBe(
        400,
      );
      expect(
        (
          await exchange(
            client.state.publicId,
            code,
            "https://wrong.example.test",
          )
        ).status,
      ).toBe(400);
      const issued = await tokens(await exchange(client.state.publicId, code));
      expect(issued.scope).toBe("read");
      expect(
        await admit(runtime.oauth, issued.access_token, "read"),
      ).toBeDefined();
      expect(
        await admit(runtime.oauth, issued.access_token, "write"),
      ).toBeUndefined();
      const persisted = JSON.stringify(
        await db.selectFrom("iam_oauth_artifacts").selectAll().execute(),
      );
      for (const bearer of [
        sid.value,
        code,
        issued.access_token,
        issued.refresh_token,
      ]) {
        expect(persisted).not.toContain(bearer);
      }
    });

    it("suppresses commit-failed consent and token responses and supports retry of rolled back consumption", async () => {
      const { sid, client } = await fixture();
      const user = browser(sid.value);
      const path = await prompt(client.state.publicId, user);
      await sql`insert into oauth_test_faults values ('Grant')`.execute(db);
      try {
        const failed = await user.request(path, { selected: ["read"] });
        expect(failed.status).toBe(503);
        expect(location(failed)).toBe("");
        expect(failed.headers.getSetCookie()).toEqual([]);
      } finally {
        await sql`delete from oauth_test_faults`.execute(db);
      }
      const code = await approve(user, path);
      await sql`insert into oauth_test_faults values ('AccessToken')`.execute(
        db,
      );
      try {
        const failed = await exchange(client.state.publicId, code);
        expect(failed.status).toBe(503);
        expect(await failed.json()).toEqual({ error: "server_error" });
      } finally {
        await sql`delete from oauth_test_faults`.execute(db);
      }
      await tokens(await exchange(client.state.publicId, code));
    });

    it("rolls back consumption when the socket disconnects before the commit decision", async () => {
      const { sid, client } = await fixture();
      const user = browser(sid.value);
      const code = await approve(
        user,
        await prompt(client.state.publicId, user),
      );
      const form = new URLSearchParams({
        client_id: client.state.publicId,
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        redirect_uri: redirect,
        resource: resource.uri,
      }).toString();
      await sql`insert into oauth_test_faults values ('Disconnect')`.execute(
        db,
      );
      try {
        await db.connection().execute(async (connection) => {
          await sql`select pg_advisory_lock(7210446)`.execute(connection);
          const request = httpRequest(runtime.address + "/token", {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              "content-length": Buffer.byteLength(form),
            },
          });
          const closed = new Promise<void>((resolve) =>
            request.on("error", () => resolve()),
          );
          request.end(form);
          try {
            const deadline = performance.now() + 900;
            let waiting = false;
            do {
              const result = await sql<{ blocked: boolean }>`
                select exists (select 1 from pg_locks
                  where locktype = 'advisory' and objid = 7210446 and not granted) as blocked
              `.execute(connection);
              waiting = result.rows[0]?.blocked ?? false;
              if (!waiting) {
                await delay(10);
              }
            } while (!waiting && performance.now() < deadline);
            expect(waiting).toBe(true);
            request.destroy();
            await closed;
            await delay(25);
          } finally {
            request.destroy();
            await sql`select pg_advisory_unlock(7210446)`.execute(connection);
          }
        });
      } finally {
        await sql`delete from oauth_test_faults`.execute(db);
      }
      await tokens(await exchange(client.state.publicId, code));
    });

    it("retains grant lineage across rotation, withdrawal, regrant and cross-instance replay", async () => {
      const { accountId, sid, client } = await fixture();
      const user = browser(sid.value);
      const publicId = client.state.publicId;
      const code = await approve(user, await prompt(publicId, user));
      const initial = await tokens(await exchange(publicId, code));
      const grantId = await store.write(accountId, async (writer) => {
        const grant = (await writer.grants(accountId))[0];
        if (!grant) {
          throw new Error("Expected a test grant");
        }
        await writer.saveGrantRestriction(
          grant.withdraw("write", ["read"], new Date()),
          { permission: "write" },
        );
        return grant.state.id;
      });
      expect(
        await admit(runtime.oauth, initial.access_token, "write"),
      ).toBeUndefined();
      await approve(user, await prompt(publicId, user));
      expect(
        await admit(runtime.oauth, initial.access_token, "write"),
      ).toBeUndefined();
      const rotatedKeys: OAuthOptions = {
        ...keys,
        artifactKeys: [randomBytes(32), keys.artifactKeys[0]],
        bindingKeys: [randomBytes(32), keys.bindingKeys[0]],
        cookieKeys: [randomBytes(32).toString("base64url"), keys.cookieKeys[0]],
      };
      const second = await start(rotatedKeys);
      const refresh = {
        client_id: publicId,
        grant_type: "refresh_token",
        refresh_token: initial.refresh_token,
      };
      const renewed = await tokens(await token(refresh, second.address));
      expect(renewed.scope).toBe("read");
      expect(
        await admit(second.oauth, renewed.access_token, "read"),
      ).toBeDefined();
      await sessions.delete(sid);
      expect((await token(refresh, second.address)).status).toBe(400);
      expect(
        await admit(second.oauth, renewed.access_token, "read"),
      ).toBeUndefined();
      const facts = await db
        .selectFrom("messaging_outbox")
        .select("topic")
        .where("aggregate_id", "=", grantId)
        .execute();
      expect(facts.map(({ topic }) => topic)).toEqual(
        expect.arrayContaining([
          "iam.delegated-grant-created",
          "iam.delegated-grant-extended",
        ]),
      );
    });

    it("serializes concurrent redemption and commits replay invalidation of only the credential family", async () => {
      const { accountId, sid, client } = await fixture();
      const user = browser(sid.value);
      const publicId = client.state.publicId;
      const code = await approve(user, await prompt(publicId, user));
      const address = await startPeer();
      const results = await Promise.all([
        exchange(publicId, code),
        token(
          {
            client_id: publicId,
            grant_type: "authorization_code",
            code,
            code_verifier: verifier,
            redirect_uri: redirect,
          },
          address,
        ),
      ]);
      expect(results.map(({ status }) => status).sort()).toEqual([200, 400]);
      const successful = results.find(({ status }) => status === 200);
      if (!successful) {
        throw new Error("Expected one successful exchange");
      }
      const issued = await tokens(successful);
      expect(
        await admit(runtime.oauth, issued.access_token, "read"),
      ).toBeUndefined();
      await store.read(async (reader) => {
        expect(
          await reader.activeGrant({
            accountId,
            clientId: client.state.id,
            resourceId: resource.id,
          }),
        ).toBeDefined();
      });
      const anotherCode = await approve(user, await prompt(publicId, user));
      const second = await tokens(await exchange(publicId, anotherCode));
      const refresh = {
        client_id: publicId,
        grant_type: "refresh_token",
        refresh_token: second.refresh_token,
      };
      const renewal = await Promise.all([
        token(refresh),
        token(refresh, address),
      ]);
      expect(renewal.map(({ status }) => status).sort()).toEqual([200, 400]);
      expect((await token(refresh)).status).toBe(400);
    });

    it("rejects stale authorization after revocation, stale Redis generation and an expired family", async () => {
      const { accountId, sid, client } = await fixture();
      const user = browser(sid.value);
      const publicId = client.state.publicId;
      const page = await prompt(publicId, user);
      await store.write(accountId, (writer) =>
        writer.revokeAccountGrants(accountId),
      );
      const stale = await user.request(page, { selected: ["read"] });
      const denied = await user.request(location(stale));
      expect(new URL(location(denied)).searchParams.get("error")).toBe(
        "access_denied",
      );
      const code = await approve(user, await prompt(publicId, user));
      const issued = await tokens(await exchange(publicId, code));
      await db
        .updateTable("iam_oauth_families")
        .set({ expires_at: new Date(Date.now() - 1) })
        .where("account_id", "=", accountId)
        .execute();
      expect(
        await admit(runtime.oauth, issued.access_token, "read"),
      ).toBeUndefined();
      expect(
        (
          await token({
            client_id: publicId,
            grant_type: "refresh_token",
            refresh_token: issued.refresh_token,
          })
        ).status,
      ).toBe(400);
      await runtime.oauth.purgeExpired();
      expect(
        await db
          .selectFrom("iam_oauth_families")
          .select("id")
          .where("account_id", "=", accountId)
          .execute(),
      ).toEqual([]);
      const interaction = await prompt(publicId, user);
      await db
        .updateTable("iam_users")
        .set({ session_version: 2 })
        .where("id", "=", accountId)
        .execute();
      expect(
        (await user.request(interaction, { selected: ["read"] })).status,
      ).toBe(403);
    });
  },
);
