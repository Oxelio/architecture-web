import { randomUUID } from "node:crypto";

import { AuditApplication } from "@architecture/audit/application";
import { KyselyAuditRepositoryAdapter } from "@architecture/audit-persistence-kysely";
import {
  PasswordValidation,
  PublishedIamPolicies,
  ResetRecoveredPasswordUseCase,
} from "@architecture/iam/application";
import {
  DEFAULT_SECURITY_POLICY,
  LoginIdentifierValueObject,
  LoginIdentityEntity,
  PasswordAuthenticatorEntity,
  SessionEntity,
  UserEntity,
  UserRoleValueObject,
} from "@architecture/iam/domain";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import {
  type IamDatabase,
  KyselyAccountDeletionAdapter,
  KyselyAccountExportAdapter,
  KyselyIamUnitOfWorkAdapter,
  KyselyLoginIdentityAdapter,
  KyselyMfaAdapter,
  KyselyPasswordAuthenticatorAdapter,
  KyselyPasswordRecoveryAdapter,
  KyselySecurityConfigurationAdapter,
  KyselyUserAdapter,
} from "@architecture/iam-persistence-kysely";
import { RedisSessionAdapter } from "@architecture/iam-session-redis";
import { KyselyOutboxWriterAdapter } from "@architecture/messaging-persistence-kysely";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { Kysely, PostgresDialect } from "kysely";
import { Migrator } from "kysely/migration";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { authPlugin } from "#app/auth";
import { getAllMigrations } from "#app/scripts/migrations.provider";
import type { AppDatabase } from "#composition-root/database.module";
import { buildIamModule } from "#composition-root/iam.module";
import { buildIamRoutes } from "#iam/routes/index";
import { buildSecurityRoutes } from "#iam/security/security.routes";
import { errorHandler } from "#types/error-handler";

import { NodeSecurityTokensAdapter } from "./node-security-tokens.adapter.js";

const databaseUrl = process.env["IAM_INTEGRATION_DATABASE_URL"],
  redisUrl = process.env["IAM_INTEGRATION_REDIS_URL"];
if (Boolean(databaseUrl) !== Boolean(redisUrl)) {
  throw new Error("Both IAM integration URLs are required");
}
const enabled = Boolean(databaseUrl && redisUrl);
describe.skipIf(!enabled)("IAM PostgreSQL/Redis security boundaries", () => {
  let db: Kysely<AppDatabase>,
    iamDb: Kysely<IamDatabase>,
    redis: Redis,
    admin: Pool;
  let module: Awaited<ReturnType<typeof buildIamModule>>;
  const schema = `iam_test_${randomUUID().replaceAll("-", "")}`,
    usersCreated: string[] = [];
  const tokens = new NodeSecurityTokensAdapter(),
    hasher = new Argon2PasswordHasherAdapter();
  const outbox = (trx: Kysely<IamDatabase>) =>
    new KyselyOutboxWriterAdapter(trx as never);
  beforeAll(async () => {
    if (!databaseUrl || !redisUrl) {
      throw new Error("Missing integration endpoints");
    }
    if (
      !new URL(databaseUrl).pathname.slice(1).startsWith("iam_refactor_test")
    ) {
      throw new Error(
        "IAM integration database name must start with iam_refactor_test",
      );
    }
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`create schema "${schema}"`);
    db = new Kysely<AppDatabase>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
          options: `-c search_path=${schema}`,
        }),
      }),
    });
    iamDb = db as unknown as Kysely<IamDatabase>;
    const migrated = await new Migrator({
      db,
      migrationTableSchema: schema,
      provider: { getMigrations: async () => getAllMigrations() },
    }).migrateToLatest();
    if (migrated.error) {
      throw migrated.error;
    }
    redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    await redis.ping();
    module = await buildIamModule(
      db,
      redis,
      new NodemailerEmailSenderAdapter(
        "localhost",
        1025,
        "",
        "",
        "test@example.test",
        "http://localhost/verify",
      ),
      outbox(iamDb),
      new AuditApplication(new KyselyAuditRepositoryAdapter(db as never)),
      {
        encryptionKey: "integration-test-key",
        recoveryUrl: "http://localhost/recovery",
        deletionCancellationUrl: "http://localhost/cancellation",
      },
    );
  }, 30000);
  afterAll(async () => {
    if (redis) {
      const sessions = new RedisSessionAdapter(redis);
      for (const id of usersCreated) {
        const user = await db
          .selectFrom("iam_users")
          .select("id")
          .where("id", "=", id)
          .executeTakeFirst();
        if (user) {
          const root = await new KyselyUserAdapter(iamDb).findById(
            await seedIdentifier(id),
          );
          if (root) {
            await sessions.deleteAllForUser(root.identifier);
          }
        }
      }
      await redis.quit();
    }
    if (db) {
      await db.destroy();
    }
    if (admin) {
      await admin.query(`drop schema "${schema}" cascade`);
      await admin.end();
    }
  }, 30000);
  async function seedIdentifier(id: string) {
    const { UserIdentifierValueObject } =
      await import("@architecture/iam/domain");
    const result = UserIdentifierValueObject.create(id);
    if (!result.success) {
      throw new Error("Invalid fixture id");
    }
    return result.value;
  }
  async function account(administrator = false) {
    const user = UserEntity.create();
    if (administrator) {
      user.changeRole(UserRoleValueObject.admin());
    }
    const users = new KyselyUserAdapter(iamDb, outbox(iamDb)),
      identities = new KyselyLoginIdentityAdapter(iamDb, outbox(iamDb)),
      passwords = new KyselyPasswordAuthenticatorAdapter(iamDb, outbox(iamDb));
    await users.save(user);
    usersCreated.push(user.identifier.value);
    const login = LoginIdentifierValueObject.create(
      "email",
      `${user.identifier.value}@example.test`,
    );
    if (!login.success) {
      throw new Error("Invalid fixture email");
    }
    const identity = LoginIdentityEntity.create({
      userId: user.identifier,
      login: login.value,
      verificationRequired: true,
    });
    identity.verify();
    await identities.save(identity);
    const plain = (
      await import("@architecture/iam/domain")
    ).PasswordPlainValueObject.create("initial long account password");
    if (!plain.success) {
      throw new Error("Invalid fixture password");
    }
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: user.identifier,
      passwordHash: await hasher.hash(plain.value),
    });
    await passwords.save(authenticator);
    return { user, authenticator, users, identities, passwords };
  }
  beforeEach(async () => {
    await db
      .updateTable("iam_users")
      .set({ role: "user" })
      .where("role", "=", "admin")
      .execute();
    await db
      .updateTable("iam_security_config_revisions")
      .set({
        values: JSON.stringify(DEFAULT_SECURITY_POLICY),
        representation_version: 2,
      })
      .where("status", "=", "published")
      .execute();
  });
  it("publishes exactly one winner for concurrent administrators", async () => {
    const actor = await account(true);
    const store = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    await store.initialize();
    const current = await store.readPublished();
    const results = await Promise.all(
      [300, 600].map((duration) =>
        store.publish({
          actorId: actor.user.identifier.value,
          expectedVersion: current.version,
          values: {
            ...structuredClone(DEFAULT_SECURITY_POLICY),
            sessions: { userManagement: true, durationMinutes: duration },
          },
          justification: "Integration race",
          changedKeys: ["sessions.durationMinutes"],
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.history()).toHaveLength(2);
    const published = await db
      .selectFrom("iam_security_config_revisions")
      .selectAll()
      .where("status", "=", "published")
      .execute();
    expect(published).toHaveLength(1);
  });
  function resetUseCase(
    f: Awaited<ReturnType<typeof account>>,
    recovery: KyselyPasswordRecoveryAdapter,
    sessions = new RedisSessionAdapter(redis),
  ) {
    const config = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    return new ResetRecoveredPasswordUseCase(
      recovery,
      f.users,
      f.passwords,
      f.identities,
      new PublishedIamPolicies(config),
      new PasswordValidation(
        { evaluate: async () => "very_strong" },
        { isCommon: async () => false },
        { isCompromised: async () => false },
      ),
      hasher,
      tokens,
      sessions,
    );
  }
  async function recoveryFor(
    f: Awaited<ReturnType<typeof account>>,
    store = new KyselyPasswordRecoveryAdapter(iamDb, outbox),
  ) {
    const token = tokens.generate(),
      now = new Date();
    await store.issue({
      id: randomUUID(),
      userId: f.user.identifier.value,
      tokenHash: tokens.hash(token),
      emailFingerprint: tokens.hash(`${f.user.identifier.value}@example.test`),
      identityId: requiredFixture(
        await f.identities.findForUser(f.user.identifier, "email"),
      ).identifier.value,
      email: `${f.user.identifier.value}@example.test`,
      expiresAt: new Date(now.getTime() + 60000),
      now,
      maximumPerHour: 5,
    });
    return {
      store,
      input: {
        token,
        password: "a unique long replacement passphrase for testing",
        passwordConfirmation:
          "a unique long replacement passphrase for testing",
        context: { actorType: "anonymous" as const },
      },
    };
  }
  it("allows only one concurrent token consumption and commits the version and outbox", async () => {
    const f = await account(),
      recovery = await recoveryFor(f),
      useCase = resetUseCase(f, recovery.store);
    const outcomes = await Promise.all([
      useCase.execute(recovery.input),
      useCase.execute(recovery.input),
    ]);
    expect(outcomes.filter((result) => result.success)).toHaveLength(1);
    expect((await f.users.findById(f.user.identifier))?.sessionVersion).toBe(2);
    const events = await db
      .selectFrom("messaging_outbox")
      .selectAll()
      .where("topic", "=", "account.recovery.completed")
      .where("aggregate_id", "=", f.user.identifier.value)
      .execute();
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(recovery.input.token);
  });
  it("rolls back token consumption when the transactional outbox fails", async () => {
    const f = await account(),
      failure = new Error("outbox unavailable"),
      store = new KyselyPasswordRecoveryAdapter(iamDb, () => ({
        append: async () => {
          throw failure;
        },
      }));
    const recovery = await recoveryFor(f, store);
    await expect(resetUseCase(f, store).execute(recovery.input)).rejects.toBe(
      failure,
    );
    expect(
      (await store.find(tokens.hash(recovery.input.token)))?.consumedAt,
    ).toBeNull();
    expect((await f.users.findById(f.user.identifier))?.sessionVersion).toBe(1);
  });
  it("rejects a stale Redis session even when post-commit cleanup fails", async () => {
    const f = await account(),
      sessions = new RedisSessionAdapter(redis),
      session = SessionEntity.createForUser({
        userId: f.user.identifier,
        userSessionVersion: 1,
        expiresAt: new Date(Date.now() + 60000),
      });
    await sessions.save(session);
    const recovery = await recoveryFor(f),
      failure = new Error("Redis cleanup unavailable");
    const failedCleanup = Object.create(sessions) as RedisSessionAdapter;
    failedCleanup.deleteAllForUser = async () => {
      throw failure;
    };
    await expect(
      resetUseCase(f, recovery.store, failedCleanup).execute(recovery.input),
    ).rejects.toBe(failure);
    expect(
      (
        await module.iam.authentication.resolveSession.execute({
          sessionId: session.identifier.value,
        })
      ).success,
    ).toBe(false);
  });
  it("consumes a backup factor once and bounds concurrent failed challenge attempts", async () => {
    const f = await account(),
      store = new KyselyMfaAdapter(iamDb, outbox),
      now = new Date(),
      sealedSecret = "sealed fixture";
    await store.beginEnrollment(
      {
        userId: f.user.identifier.value,
        sealedSecret,
        enrollmentExpiresAt: new Date(now.getTime() + 60000),
        enabledAt: null,
        lastCounter: null,
      },
      now,
    );
    const confirmationId = randomUUID();
    await store.confirmEnrollment({
      userId: f.user.identifier.value,
      sealedSecret,
      counter: Math.floor(Date.now() / 30000),
      backupHashes: [tokens.hash("BACKUP")],
      confirmationId,
      now,
    });
    f.user.invalidateSessions();
    expect(await store.activate({ user: f.user, confirmationId, now })).toBe(
      true,
    );
    expect(
      await store.beginEnrollment(
        {
          userId: f.user.identifier.value,
          sealedSecret: "replacement",
          enrollmentExpiresAt: new Date(now.getTime() + 60000),
          enabledAt: null,
          lastCounter: null,
        },
        now,
      ),
    ).toBe(false);
    const challenge = await store.beginChallenge({
      id: randomUUID(),
      userId: f.user.identifier.value,
      expiresAt: new Date(now.getTime() + 60000),
      maximumAttempts: 3,
      userSessionVersion: f.user.sessionVersion,
      now,
    });
    const successes = await Promise.all(
      [1, 2].map(() =>
        store.verify({
          userId: f.user.identifier.value,
          sealedSecret,
          counter: null,
          backupHash: tokens.hash("BACKUP"),
          challengeId: requiredFixture(challenge).id,
          now,
        }),
      ),
    );
    expect(successes.filter(Boolean)).toHaveLength(1);
    const next = await store.beginChallenge({
      id: randomUUID(),
      userId: f.user.identifier.value,
      expiresAt: new Date(now.getTime() + 60000),
      maximumAttempts: 3,
      userSessionVersion: f.user.sessionVersion,
      now,
    });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        store.verify({
          userId: f.user.identifier.value,
          sealedSecret,
          counter: null,
          backupHash: tokens.hash("WRONG"),
          challengeId: requiredFixture(next).id,
          now,
        }),
      ),
    );
    expect(
      (await store.findChallenge(requiredFixture(next).id))?.attempts,
    ).toBe(3);
  });
  it("downloads an archive once under concurrent requests", async () => {
    const f = await account(),
      store = new KyselyAccountExportAdapter(iamDb, outbox),
      id = randomUUID(),
      now = new Date();
    await store.reserve(f.user.identifier.value, id, now);
    await store.complete(id, new Uint8Array([80, 75, 3, 4]), now);
    const downloads = await Promise.all([
      store.take(f.user.identifier.value, id, now),
      store.take(f.user.identifier.value, id, now),
    ]);
    expect(downloads.filter(Boolean)).toHaveLength(1);
    expect(
      (
        await db
          .selectFrom("iam_account_exports")
          .select("archive")
          .where("id", "=", id)
          .executeTakeFirstOrThrow()
      ).archive,
    ).toBeNull();
  });
  it("preserves one active administrator during concurrent deletion requests", async () => {
    const first = await account(true),
      second = await account(true),
      store = new KyselyAccountDeletionAdapter(iamDb, outbox),
      now = new Date();
    const outcomes = await Promise.all(
      [first, second].map((f) => {
        f.user.requestDeletion();
        return store.request({
          user: f.user,
          previousStatus: "active",
          requireAnotherAdministrator: true,
          id: randomUUID(),
          tokenHash: tokens.hash(randomUUID()),
          now,
          scheduledFor: new Date(now.getTime() + 86400000),
        });
      }),
    );
    expect(outcomes.sort()).toEqual(["last_administrator", "saved"]);
  });
  it("keeps a complete policy snapshot during publication", async () => {
    const store = new KyselySecurityConfigurationAdapter(iamDb, outbox),
      reader = new PublishedIamPolicies(store),
      before = await reader.get("standard"),
      current = await store.readPublished(),
      values = structuredClone(current.values);
    values.passwords.standardMinLength = 18;
    values.passwords.maxLength = 100;
    await store.publish({
      actorId: (await account(true)).user.identifier.value,
      expectedVersion: current.version,
      values,
      justification: "Snapshot check",
      changedKeys: ["passwords.standardMinLength", "passwords.maxLength"],
    });
    const after = await reader.get("standard");
    expect(before.minLength).toBe(15);
    expect(before.maxLength).toBe(128);
    expect(after.minLength).toBe(18);
    expect(after.maxLength).toBe(100);
  });
  it("checks token expiry after acquiring the account lock", async () => {
    const f = await account(),
      recovery = await recoveryFor(f),
      now = new Date();
    await db
      .updateTable("iam_password_recoveries")
      .set({ expires_at: new Date(now.getTime() + 50) })
      .where("user_id", "=", f.user.identifier.value)
      .execute();
    const work = vi.fn(async () => true);
    let waiting: Promise<unknown> = Promise.resolve(null);
    await db.transaction().execute(async (trx) => {
      await trx
        .selectFrom("iam_users")
        .select("id")
        .where("id", "=", f.user.identifier.value)
        .forUpdate()
        .executeTakeFirstOrThrow();
      waiting = recovery.store.withUsableToken(
        tokens.hash(recovery.input.token),
        now,
        work,
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(await waiting).toBeNull();
    expect(work).not.toHaveBeenCalled();
  });
  it("rejects replay of a TOTP counter under concurrent verification", async () => {
    const f = await account(),
      store = new KyselyMfaAdapter(iamDb, outbox),
      now = new Date(),
      counter = Math.floor(Date.now() / 30000),
      confirmationId = randomUUID(),
      sealedSecret = "sealed TOTP fixture";
    await store.beginEnrollment(
      {
        userId: f.user.identifier.value,
        sealedSecret,
        enrollmentExpiresAt: new Date(now.getTime() + 60000),
        enabledAt: null,
        lastCounter: null,
      },
      now,
    );
    await store.confirmEnrollment({
      userId: f.user.identifier.value,
      sealedSecret,
      counter: counter - 1,
      backupHashes: [tokens.hash("UNUSED")],
      confirmationId,
      now,
    });
    f.user.invalidateSessions();
    expect(await store.activate({ user: f.user, confirmationId, now })).toBe(
      true,
    );
    const outcomes = await Promise.all(
      [1, 2].map(() =>
        store.verify({
          userId: f.user.identifier.value,
          sealedSecret,
          counter,
          backupHash: tokens.hash("NOT_A_BACKUP"),
          now,
        }),
      ),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(
      await store.verify({
        userId: f.user.identifier.value,
        sealedSecret,
        counter: counter - 5,
        backupHash: tokens.hash("NOT_A_BACKUP"),
        now,
      }),
    ).toBeNull();
  });
  it("cancels a deletion once and preserves the previous suspension", async () => {
    const f = await account(),
      store = new KyselyAccountDeletionAdapter(iamDb, outbox),
      now = new Date(),
      id = randomUUID();
    f.user.suspend();
    await f.users.save(f.user);
    f.user.requestDeletion();
    expect(
      await store.request({
        user: f.user,
        previousStatus: "suspended",
        requireAnotherAdministrator: false,
        id,
        tokenHash: tokens.hash(randomUUID()),
        now,
        scheduledFor: new Date(now.getTime() + 60000),
      }),
    ).toBe("saved");
    const roots = await Promise.all([
      f.users.findById(f.user.identifier),
      f.users.findById(f.user.identifier),
    ]);
    const outcomes = await Promise.all(
      roots.map((user) => {
        if (!user) {
          throw new Error("Missing test account");
        }
        user.cancelDeletion("suspended");
        return store.cancel({ user, requestId: id, now: new Date() });
      }),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const restored = await f.users.findById(f.user.identifier);
    expect(restored?.status.isSuspended()).toBe(true);
    expect(restored?.sessionVersion).toBe(2);
  });
  it("preserves real HTTP authentication and invalidates the cookie after password change", async () => {
    const f = await account(),
      app = Fastify(),
      cookie = {
        name: "sid",
        options: { path: "/", httpOnly: true, sameSite: "lax" as const },
      };
    try {
      app.setErrorHandler(errorHandler);
      await app.register(authPlugin, {
        resolveSession: module.iam.authentication.resolveSession,
        sessionCookieName: "sid",
      });
      await app.register(buildIamRoutes(module.iam, cookie), {
        prefix: "/v1/iam",
      });
      await app.register(
        buildSecurityRoutes(
          module.iam,
          cookie,
          new AuditApplication(new KyselyAuditRepositoryAdapter(db as never)),
          module.configuration,
          module.securityEvents,
        ),
        { prefix: "/v1/iam" },
      );
      const login = await app.inject({
        method: "POST",
        url: "/v1/iam/signin",
        payload: {
          login: {
            kind: "email",
            value: `${f.user.identifier.value}@example.test`,
          },
          password: "initial long account password",
        },
      });
      expect(login.statusCode).toBe(204);
      const session = login.cookies.find((item) => item.name === "sid");
      if (!session) {
        throw new Error("Missing authenticated test cookie");
      }
      const headers = { cookie: `sid=${session.value}` };
      expect(
        (await app.inject({ url: "/v1/iam/me", headers })).statusCode,
      ).toBe(200);
      const password = "a separate sufficiently long replacement passphrase";
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: "/v1/iam/me/password",
            headers,
            payload: {
              currentPassword: "initial long account password",
              password,
              passwordConfirmation: password,
            },
          })
        ).statusCode,
      ).toBe(204);
      expect(
        (await app.inject({ url: "/v1/iam/me", headers })).statusCode,
      ).toBe(401);
      const events = await db
        .selectFrom("messaging_outbox")
        .selectAll()
        .where("topic", "=", "iam.session-started")
        .where("aggregate_id", "=", f.user.identifier.value)
        .execute();
      expect(events).toHaveLength(1);
      expect(events[0]?.version).toBe(2);
      expect(JSON.stringify(events)).not.toContain(session.value);
    } finally {
      await app.close();
    }
  });
  it("honors legal hold and executes final deletion idempotently", async () => {
    const f = await account(),
      store = new KyselyAccountDeletionAdapter(iamDb, outbox),
      now = new Date(),
      id = randomUUID();
    f.user.requestDeletion();
    await store.request({
      user: f.user,
      previousStatus: "active",
      requireAnotherAdministrator: false,
      id,
      tokenHash: tokens.hash(randomUUID()),
      now,
      scheduledFor: new Date(now.getTime() - 1000),
    });
    await db
      .updateTable("iam_account_deletions")
      .set({ legal_hold_reason: "test hold" })
      .where("id", "=", id)
      .execute();
    const pseudonymize = vi.fn(async () => undefined);
    expect(await store.eraseIfDue(id, new Date(), pseudonymize)).toBeNull();
    expect(pseudonymize).not.toHaveBeenCalled();
    await db
      .updateTable("iam_account_deletions")
      .set({ legal_hold_reason: null })
      .where("id", "=", id)
      .execute();
    const outcomes = await Promise.all([
      store.eraseIfDue(id, new Date(), pseudonymize),
      store.eraseIfDue(id, new Date(), pseudonymize),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(pseudonymize).toHaveBeenCalledOnce();
    expect(await f.users.findById(f.user.identifier)).toBeNull();
    const events = await db
      .selectFrom("messaging_outbox")
      .selectAll()
      .where("topic", "=", "account.deletion.executed")
      .execute();
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(f.user.identifier.value);
  });
  function requiredFixture<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) {
      throw new Error("Missing integration fixture");
    }
    return value;
  }
  function barrier() {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { wait, release };
  }
  it.each([
    ["change", false],
    ["recovery", false],
    ["revocation", false],
    ["change", true],
    ["recovery", true],
  ] as const)(
    "does not restore a credential after concurrent %s (MFA %s)",
    async (kind, mfa) => {
      const f = await account();
      if (mfa) {
        await db
          .insertInto("iam_mfa_settings")
          .values({
            user_id: f.user.identifier.value,
            encrypted_secret: "sealed-test-fixture",
            enrollment_expires_at: null,
            enabled_at: new Date(),
            last_totp_counter: null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute();
      }
      const entered = barrier(),
        resume = barrier();
      const original = Argon2PasswordHasherAdapter.prototype.verify;
      let first = true;
      const verification = vi
        .spyOn(Argon2PasswordHasherAdapter.prototype, "verify")
        .mockImplementation(async function (
          this: Argon2PasswordHasherAdapter,
          plain,
          hash,
        ) {
          const valid = await original.call(this, plain, hash);
          if (first) {
            first = false;
            entered.release();
            await resume.wait;
          }
          return valid;
        });
      const login = {
        kind: "email" as const,
        value: `${f.user.identifier.value}@example.test`,
      };
      const attempt = module.iam.authentication.signIn.execute({
        login,
        password: "initial long account password",
      });
      try {
        await entered.wait;
        if (kind === "revocation") {
          f.authenticator.revoke();
          await f.passwords.save(f.authenticator);
        } else if (kind === "change") {
          const result = await module.iam.accounts.changePassword.execute({
            userId: f.user.identifier.value,
            currentPassword: "initial long account password",
            password: "a unique long replacement passphrase for testing",
            passwordConfirmation:
              "a unique long replacement passphrase for testing",
          });
          expect(result.success).toBe(true);
        } else {
          const recovery = await recoveryFor(f);
          expect(
            (await resetUseCase(f, recovery.store).execute(recovery.input))
              .success,
          ).toBe(true);
        }
        const authoritative = await db
          .selectFrom("iam_password_authenticators")
          .selectAll()
          .where("user_id", "=", f.user.identifier.value)
          .executeTakeFirstOrThrow();
        resume.release();
        expect((await attempt).success).toBe(false);
        const after = await db
          .selectFrom("iam_password_authenticators")
          .selectAll()
          .where("user_id", "=", f.user.identifier.value)
          .executeTakeFirstOrThrow();
        expect(after.password_hash).toBe(authoritative.password_hash);
        expect(after.revoked_at).toEqual(authoritative.revoked_at);
        expect(
          (
            await module.iam.authentication.signIn.execute({
              login,
              password: "initial long account password",
            })
          ).success,
        ).toBe(false);
      } finally {
        resume.release();
        verification.mockRestore();
      }
    },
  );
  it("rejects an obsolete account version between credential bookkeeping and session issuance", async () => {
    const f = await account(),
      entered = barrier(),
      resume = barrier();
    const original =
      KyselyPasswordAuthenticatorAdapter.prototype.recordSuccessfulUse;
    const bookkeeping = vi
      .spyOn(
        KyselyPasswordAuthenticatorAdapter.prototype,
        "recordSuccessfulUse",
      )
      .mockImplementation(async function (
        this: KyselyPasswordAuthenticatorAdapter,
        credential,
        at,
      ) {
        const accepted = await original.call(this, credential, at);
        entered.release();
        await resume.wait;
        return accepted;
      });
    const attempt = module.iam.authentication.signIn.execute({
      login: {
        kind: "email",
        value: `${f.user.identifier.value}@example.test`,
      },
      password: "initial long account password",
    });
    try {
      await entered.wait;
      const recovery = await recoveryFor(f);
      expect(
        (await resetUseCase(f, recovery.store).execute(recovery.input)).success,
      ).toBe(true);
      resume.release();
      expect((await attempt).success).toBe(false);
      expect(
        await new RedisSessionAdapter(redis).findActiveForUser(
          f.user.identifier,
        ),
      ).toHaveLength(0);
    } finally {
      resume.release();
      bookkeeping.mockRestore();
    }
  });
  it.each(["issue-first", "change-first"] as const)(
    "binds recovery to the current verified identity: %s",
    async (ordering) => {
      const f = await account(),
        store = new KyselyPasswordRecoveryAdapter(iamDb, outbox);
      const identity = await f.identities.findForUser(
        f.user.identifier,
        "email",
      );
      if (!identity) {
        throw new Error("Missing recovery identity fixture");
      }
      const token = tokens.generate(),
        now = new Date();
      const issue = () =>
        store.issue({
          id: randomUUID(),
          userId: f.user.identifier.value,
          identityId: identity.identifier.value,
          email: `${f.user.identifier.value}@example.test`,
          emailFingerprint: tokens.hash(
            `${f.user.identifier.value}@example.test`,
          ),
          tokenHash: tokens.hash(token),
          now,
          expiresAt: new Date(now.getTime() + 60000),
          maximumPerHour: 5,
        });
      const change = () =>
        new KyselyIamUnitOfWorkAdapter(iamDb, outbox).executeForUser(
          f.user.identifier,
          async ({ loginIdentities }) => {
            const current = requiredFixture(
              await loginIdentities.findForUser(f.user.identifier, "email"),
            );
            const login = LoginIdentifierValueObject.create(
              "email",
              `replacement-${f.user.identifier.value}@example.test`,
            );
            if (!login.success) {
              throw new Error("Invalid fixture email");
            }
            current.replace(login.value, true);
            await loginIdentities.save(current);
          },
        );
      if (ordering === "issue-first") {
        expect(await issue()).toBe(true);
        await change();
      } else {
        await change();
        expect(await issue()).toBe(false);
      }
      expect(
        await store.withUsableToken(
          tokens.hash(token),
          new Date(),
          async () => true,
        ),
      ).toBeNull();
    },
  );
  it("refuses publication and restoration values that remove the final usable administrator", async () => {
    const actor = await account(true),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    const current = await store.readPublished();
    for (const values of [
      {
        ...structuredClone(current.values),
        accounts: {
          ...current.values.accounts,
          allowedLoginIdentifiers: ["username" as const],
        },
      },
      {
        ...structuredClone(current.values),
        authentication: {
          ...current.values.authentication,
          mfaRequiredRoles: ["admin" as const],
        },
      },
    ]) {
      expect(
        await store.publish({
          actorId: actor.user.identifier.value,
          values,
          expectedVersion: current.version,
          justification: "Unsafe access change",
          changedKeys: [],
          origin: "restoration",
          restoredFromRevisionId: current.id,
        }),
      ).toBe("last_administrator");
      expect((await store.readPublished()).id).toBe(current.id);
    }
    expect(
      await store.publish({
        actorId: actor.user.identifier.value,
        values: current.values,
        expectedVersion: current.version,
        justification: "Preserve access",
        changedKeys: [],
      }),
    ).toMatchObject({ version: current.version + 1 });
  });
  it("serializes mutual administrator suspension and rechecks actor authority", async () => {
    const a = await account(true),
      b = await account(true);
    const results = await Promise.all([
      module.iam.administration.suspendUser.execute({
        actorUserId: a.user.identifier.value,
        userId: b.user.identifier.value,
      }),
      module.iam.administration.suspendUser.execute({
        actorUserId: b.user.identifier.value,
        userId: a.user.identifier.value,
      }),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(
      await db
        .selectFrom("iam_users")
        .select("id")
        .where("role", "=", "admin")
        .where("status", "=", "active")
        .execute(),
    ).toHaveLength(1);
  });
  it("decodes legacy published values without replacing administered settings or rewriting history", async () => {
    const store = new KyselySecurityConfigurationAdapter(iamDb, outbox),
      actor = await account(true);
    const current = await store.readPublished();
    const { allowedLoginIdentifiers: _identifiers, ...accounts } =
      current.values.accounts;
    const legacy = { ...structuredClone(current.values), accounts };
    legacy["sessions"].durationMinutes = 137;
    legacy["authentication"].mfaRequiredRoles = ["user", "user"];
    await db
      .updateTable("iam_security_config_revisions")
      .set({ values: JSON.stringify(legacy), representation_version: 1 })
      .where("id", "=", current.id)
      .execute();
    await store.initialize();
    const decoded = await store.readPublished();
    expect(decoded.values.accounts.allowedLoginIdentifiers).toEqual(["email"]);
    expect(decoded.values.sessions.durationMinutes).toBe(137);
    expect(decoded.values.authentication.mfaRequiredRoles).toEqual(["user"]);
    expect(
      (
        await db
          .selectFrom("iam_security_config_revisions")
          .select("values")
          .where("id", "=", current.id)
          .executeTakeFirstOrThrow()
      ).values,
    ).toEqual(legacy);
    const restored =
      await module.iam.administration.restoreConfiguration.execute({
        actorId: actor.user.identifier.value,
        revisionId: current.id,
        expectedVersion: current.version,
        justification: "Restore compatible legacy configuration",
        confirmedCritical: true,
      });
    expect(restored.success).toBe(true);
    expect((await store.readPublished()).values.sessions.durationMinutes).toBe(
      137,
    );
  });

  it("keeps registration permission, verification and password requirements from one revision", async () => {
    const actor = await account(true),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    const current = await store.readPublished(),
      original = KyselyLoginIdentityAdapter.prototype.findByLogin;
    const next = structuredClone(current.values);
    next.accounts.publicRegistration = false;
    next.accounts.emailVerification = false;
    next.passwords.standardMinLength = 50;
    next.passwords.privilegedMinLength = 60;
    let first = true;
    const lookup = vi
      .spyOn(KyselyLoginIdentityAdapter.prototype, "findByLogin")
      .mockImplementation(async function (
        this: KyselyLoginIdentityAdapter,
        login,
      ) {
        if (first) {
          first = false;
          expect(
            await store.publish({
              actorId: actor.user.identifier.value,
              expectedVersion: current.version,
              values: next,
              justification: "Concurrent publication",
              changedKeys: [],
            }),
          ).toMatchObject({ version: current.version + 1 });
        }
        return original.call(this, login);
      });
    const mail = vi
      .spyOn(NodemailerEmailSenderAdapter.prototype, "sendVerificationEmail")
      .mockResolvedValue(undefined);
    const login = {
      kind: "email" as const,
      value: `${randomUUID()}@example.test`,
    };
    try {
      const result = await module.iam.accounts.signUp.execute({
        login,
        password: "a sufficiently long registration passphrase",
        passwordConfirmation: "a sufficiently long registration passphrase",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        usersCreated.push(result.value.userId);
      }
      expect(
        (
          await db
            .selectFrom("iam_login_identities")
            .select("verification_status")
            .where("normalized_value", "=", login.value)
            .executeTakeFirstOrThrow()
        ).verification_status,
      ).toBe("pending");
      expect(
        (
          await module.iam.accounts.signUp.execute({
            login: { kind: "username", value: "fresh-registration" },
            password: "short",
            passwordConfirmation: "short",
          })
        ).success,
      ).toBe(false);
    } finally {
      lookup.mockRestore();
      mail.mockRestore();
    }
  });
  it("keeps sign-in MFA and session lifetime from the revision that allowed the operation", async () => {
    const actor = await account(true),
      f = await account(),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    const current = await store.readPublished(),
      next = structuredClone(current.values);
    next.authentication.mfaRequiredRoles = ["user"];
    next.sessions.durationMinutes = 10;
    const original = Argon2PasswordHasherAdapter.prototype.verify;
    let first = true;
    const verification = vi
      .spyOn(Argon2PasswordHasherAdapter.prototype, "verify")
      .mockImplementation(async function (
        this: Argon2PasswordHasherAdapter,
        plain,
        hash,
      ) {
        const result = await original.call(this, plain, hash);
        if (first) {
          first = false;
          await store.publish({
            actorId: actor.user.identifier.value,
            expectedVersion: current.version,
            values: next,
            justification: "Concurrent authentication change",
            changedKeys: [],
          });
        }
        return result;
      });
    const input = {
      login: {
        kind: "email" as const,
        value: `${f.user.identifier.value}@example.test`,
      },
      password: "initial long account password",
    };
    try {
      const result = await module.iam.authentication.signIn.execute(input);
      expect(result.success).toBe(true);
      if (result.success && result.value.sessionExpiresAt) {
        expect(
          result.value.sessionExpiresAt.getTime() - Date.now(),
        ).toBeGreaterThan(40000 * 60000);
      }
      expect(
        await module.iam.authentication.signIn.execute(input),
      ).toMatchObject({
        success: false,
        error: { code: "mfa.enrollment_required" },
      });
    } finally {
      verification.mockRestore();
    }
  });

  it("upgrades a pre-refactor persisted configuration through the real migrations", async () => {
    const upgradeSchema = `iam_upgrade_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`create schema "${upgradeSchema}"`);
    const upgrade = new Kysely<AppDatabase>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: databaseUrl,
          options: `-c search_path=${upgradeSchema}`,
        }),
      }),
    });
    const provider = { getMigrations: async () => getAllMigrations() };
    const migrator = new Migrator({
      db: upgrade,
      provider,
      migrationTableSchema: upgradeSchema,
    });
    const { allowedLoginIdentifiers: _identifiers, ...accounts } =
      DEFAULT_SECURITY_POLICY.accounts;
    const legacy = {
      ...structuredClone(DEFAULT_SECURITY_POLICY),
      accounts,
      sessions: { userManagement: false, durationMinutes: 137 },
    };
    const id = randomUUID();
    try {
      const initial = await migrator.migrateTo(
        "006_enforce_iam_security_invariants",
      );
      if (initial.error) {
        throw initial.error;
      }
      await upgrade
        .insertInto("iam_security_config_revisions")
        .values({
          id,
          version: 1,
          status: "published",
          values: JSON.stringify(legacy),
          created_by: randomUUID(),
          created_at: new Date(),
          published_at: new Date(),
          previous_revision_id: null,
        })
        .execute();
      const legacyOwner = randomUUID(),
        legacyIdentity = randomUUID(),
        legacyRecovery = randomUUID(),
        legacyChallenge = randomUUID(),
        now = new Date();
      await upgrade
        .insertInto("iam_users")
        .values({
          id: legacyOwner,
          role: "user",
          status: "active",
          session_version: 1,
          created_at: now,
          updated_at: now,
        })
        .execute();
      await upgrade
        .insertInto("iam_login_identities")
        .values({
          id: legacyIdentity,
          user_id: legacyOwner,
          kind: "email",
          normalized_value: "legacy-owner@example.test",
          verification_status: "verified",
          verified_at: now,
          created_at: now,
          updated_at: now,
        })
        .execute();
      await upgrade
        .insertInto("iam_password_authenticators")
        .values({
          id: randomUUID(),
          user_id: legacyOwner,
          password_hash: "legacy-hash-fixture",
          revoked_at: null,
          last_used_at: null,
          created_at: now,
          updated_at: now,
        })
        .execute();
      await upgrade
        .insertInto("iam_password_recoveries")
        .values({
          id: legacyRecovery,
          user_id: legacyOwner,
          token_hash: tokens.hash(randomUUID()),
          email_fingerprint: tokens.hash("legacy-owner@example.test"),
          expires_at: new Date(now.getTime() + 60000),
          consumed_at: null,
          invalidated_at: null,
          created_at: now,
        })
        .execute();
      await upgrade
        .insertInto("iam_mfa_challenges")
        .values({
          id: legacyChallenge,
          user_id: legacyOwner,
          purpose: "signin",
          attempts: 0,
          max_attempts: 5,
          expires_at: new Date(now.getTime() + 60000),
          consumed_at: null,
          created_at: now,
        })
        .execute();
      const migrated = await migrator.migrateToLatest();
      if (migrated.error) {
        throw migrated.error;
      }
      const config = new KyselySecurityConfigurationAdapter(
        upgrade as unknown as Kysely<IamDatabase>,
        outbox,
      );
      expect(
        (
          await upgrade
            .selectFrom("iam_password_recoveries")
            .selectAll()
            .where("id", "=", legacyRecovery)
            .executeTakeFirstOrThrow()
        ).invalidated_at,
      ).toBeInstanceOf(Date);
      expect(
        (
          await upgrade
            .selectFrom("iam_mfa_challenges")
            .selectAll()
            .where("id", "=", legacyChallenge)
            .executeTakeFirstOrThrow()
        ).consumed_at,
      ).toBeInstanceOf(Date);
      expect(
        (
          await upgrade
            .selectFrom("iam_password_authenticators")
            .select("password_hash")
            .where("user_id", "=", legacyOwner)
            .executeTakeFirstOrThrow()
        ).password_hash,
      ).toBe("legacy-hash-fixture");

      await config.initialize();
      await config.initialize();
      expect(await config.readPublished()).toMatchObject({
        id,
        version: 1,
        values: {
          accounts: { allowedLoginIdentifiers: ["email"] },
          sessions: { userManagement: false, durationMinutes: 137 },
        },
      });
      expect(await config.history()).toHaveLength(1);
      expect(
        (
          await upgrade
            .selectFrom("iam_security_config_revisions")
            .select("values")
            .where("id", "=", id)
            .executeTakeFirstOrThrow()
        ).values,
      ).toEqual(legacy);
    } finally {
      await upgrade.destroy();
      await admin.query(`drop schema "${upgradeSchema}" cascade`);
    }
  });
  it("preserves administrative access during concurrent deletion and role removal", async () => {
    const a = await account(true),
      b = await account(true),
      store = new KyselyAccountDeletionAdapter(iamDb, outbox);
    a.user.requestDeletion();
    const now = new Date();
    await Promise.all([
      store.request({
        user: a.user,
        previousStatus: "active",
        requireAnotherAdministrator: true,
        id: randomUUID(),
        tokenHash: tokens.hash(randomUUID()),
        now,
        scheduledFor: new Date(now.getTime() + 86400000),
      }),
      module.iam.administration.assignUserRole.execute({
        actorUserId: a.user.identifier.value,
        userId: b.user.identifier.value,
        role: "user",
      }),
    ]);
    expect(
      await db
        .selectFrom("iam_users")
        .select("id")
        .where("role", "=", "admin")
        .where("status", "=", "active")
        .execute(),
    ).toHaveLength(1);
  });
  it("does not issue or consume an MFA sign-in challenge from an obsolete password generation", async () => {
    const f = await account(),
      store = new KyselyMfaAdapter(iamDb, outbox),
      now = new Date();
    await db
      .insertInto("iam_mfa_settings")
      .values({
        user_id: f.user.identifier.value,
        encrypted_secret: "sealed-test-fixture",
        enrollment_expires_at: null,
        enabled_at: now,
        last_totp_counter: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await db
      .insertInto("iam_mfa_backup_codes")
      .values({
        id: randomUUID(),
        user_id: f.user.identifier.value,
        code_hash: tokens.hash("GENERATIONBACKUP"),
        consumed_at: null,
        created_at: now,
      })
      .execute();
    // The challenge store validates account generation independently of any pre-lock application read.
    const challenge = await store.beginChallenge({
      id: randomUUID(),
      userId: f.user.identifier.value,
      userSessionVersion: f.user.sessionVersion,
      now,
      expiresAt: new Date(now.getTime() + 60000),
      maximumAttempts: 5,
    });
    expect(challenge).not.toBeNull();
    const recovery = await recoveryFor(f);
    expect(
      (await resetUseCase(f, recovery.store).execute(recovery.input)).success,
    ).toBe(true);
    expect(
      await store.beginChallenge({
        id: randomUUID(),
        userId: f.user.identifier.value,
        userSessionVersion: f.user.sessionVersion,
        now,
        expiresAt: new Date(now.getTime() + 60000),
        maximumAttempts: 5,
      }),
    ).toBeNull();
    expect(
      await module.iam.authentication.completeMfaSignIn.execute({
        challengeId: requiredFixture(challenge).id,
        code: "GENERATION-BACKUP",
      }),
    ).toMatchObject({
      success: false,
      error: { code: "mfa.invalid_challenge" },
    });
    expect(
      (
        await db
          .selectFrom("iam_mfa_backup_codes")
          .select("consumed_at")
          .where("user_id", "=", f.user.identifier.value)
          .executeTakeFirstOrThrow()
      ).consumed_at,
    ).toBeNull();
  });

  it("serializes publication with removal of the only administrator compatible with the proposed identities", async () => {
    const a = await account(true),
      b = await account(true),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox);
    const login = LoginIdentifierValueObject.create(
      "username",
      `admin-${randomUUID().slice(0, 16)}`,
    );
    if (!login.success) {
      throw new Error("Invalid fixture username");
    }
    await b.identities.save(
      LoginIdentityEntity.create({
        userId: b.user.identifier,
        login: login.value,
        verificationRequired: false,
      }),
    );
    const current = await store.readPublished(),
      values = structuredClone(current.values);
    values.accounts.allowedLoginIdentifiers = ["username"];
    await Promise.all([
      store.publish({
        actorId: a.user.identifier.value,
        expectedVersion: current.version,
        values,
        justification: "Concurrent access reduction",
        changedKeys: ["accounts.allowedLoginIdentifiers"],
      }),
      module.iam.administration.assignUserRole.execute({
        actorUserId: a.user.identifier.value,
        userId: b.user.identifier.value,
        role: "user",
      }),
    ]);
    const effective = await store.readPublished();
    expect(
      await db
        .selectFrom("iam_users as u")
        .innerJoin("iam_login_identities as i", "i.user_id", "u.id")
        .select("u.id")
        .where("u.role", "=", "admin")
        .where("u.status", "=", "active")
        .where("i.verification_status", "!=", "pending")
        .where(
          "i.kind",
          "in",
          effective.values.accounts.allowedLoginIdentifiers,
        )
        .execute(),
    ).not.toHaveLength(0);
  });
  it("applies confirmation, fresh proof and final-access protection to historical restoration", async () => {
    const f = await account(true),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox),
      current = await store.readPublished();
    const target = structuredClone(current.values);
    target.authentication.mfaRequiredRoles = ["admin"];
    const revisionId = randomUUID();
    await db
      .insertInto("iam_security_config_revisions")
      .values({
        id: revisionId,
        version: current.version + 100,
        status: "superseded",
        values: JSON.stringify(target),
        representation_version: 2,
        created_by: f.user.identifier.value,
        created_at: new Date(),
        published_at: new Date(),
        previous_revision_id: current.id,
      })
      .execute();
    const input = {
      actorId: f.user.identifier.value,
      revisionId,
      expectedVersion: current.version,
      justification: "Restore historical MFA rules",
      confirmedCritical: false,
    };
    expect(
      await module.iam.administration.restoreConfiguration.execute(input),
    ).toMatchObject({
      success: false,
      error: { code: "security_configuration.critical_confirmation_required" },
    });
    expect(
      await module.iam.administration.restoreConfiguration.execute({
        ...input,
        confirmedCritical: true,
      }),
    ).toMatchObject({
      success: false,
      error: { code: "authentication.recent_proof_required" },
    });
    const session = SessionEntity.createForUser({
      userId: f.user.identifier,
      userSessionVersion: f.user.sessionVersion,
      expiresAt: new Date(Date.now() + 60000),
    });
    await new RedisSessionAdapter(redis).saveEnforcingMaximum(session, 10);
    expect(
      await module.iam.administration.restoreConfiguration.execute({
        ...input,
        confirmedCritical: true,
        sessionId: session.identifier.value,
        password: "initial long account password",
      }),
    ).toMatchObject({
      success: false,
      error: { code: "administrator.last_active_access" },
    });
    const center = await store.readCenter();
    expect(center.published.id).toBe(current.id);
    expect(center.revisions[0]).toMatchObject({
      id: revisionId,
      status: "superseded",
    });
  });
  it("allows safe administrative alternatives and retains their comparison metadata", async () => {
    const f = await account(true),
      store = new KyselySecurityConfigurationAdapter(iamDb, outbox),
      current = await store.readPublished();
    const login = LoginIdentifierValueObject.create(
      "username",
      `safe-${randomUUID().slice(0, 16)}`,
    );
    if (!login.success) {
      throw new Error("Invalid fixture username");
    }
    await f.identities.save(
      LoginIdentityEntity.create({
        userId: f.user.identifier,
        login: login.value,
        verificationRequired: false,
      }),
    );
    await db
      .insertInto("iam_mfa_settings")
      .values({
        user_id: f.user.identifier.value,
        encrypted_secret: "sealed-test-fixture",
        enrollment_expires_at: null,
        enabled_at: new Date(),
        last_totp_counter: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
    await db
      .insertInto("iam_mfa_backup_codes")
      .values({
        id: randomUUID(),
        user_id: f.user.identifier.value,
        code_hash: tokens.hash("SAFEADMINBACKUP"),
        consumed_at: null,
        created_at: new Date(),
      })
      .execute();
    const values = structuredClone(current.values);
    values.accounts.allowedLoginIdentifiers = ["username"];
    values.authentication.mfaRequiredRoles = ["admin"];
    const published = await store.publish({
      actorId: f.user.identifier.value,
      expectedVersion: current.version,
      values,
      justification: "Retain an enrolled username administrator",
      changedKeys: [],
    });
    expect(published).toMatchObject({
      version: current.version + 1,
      createdBy: f.user.identifier.value,
      justification: "Retain an enrolled username administrator",
      origin: "administration",
      changes: expect.arrayContaining([
        expect.objectContaining({
          key: "authentication.mfaRequiredRoles",
          before: [],
          after: ["admin"],
        }),
      ]),
    });
    expect((await store.readCenter()).published.values).toEqual(values);
    const attempt = await module.iam.authentication.signIn.execute({
      login: { kind: "username", value: login.value.value },
      password: "initial long account password",
    });
    if (!attempt.success || !("challengeId" in attempt.value)) {
      throw new Error("Expected protected administrator sign-in");
    }
    const completed = await module.iam.authentication.completeMfaSignIn.execute(
      {
        challengeId: attempt.value.challengeId,
        code: "SAFE-ADMIN-BACKUP",
      },
    );
    expect(completed.success).toBe(true);
    if (completed.success) {
      expect(
        (
          await module.iam.authentication.resolveSession.execute({
            sessionId: completed.value.sessionId,
          })
        ).success,
      ).toBe(true);
    }
  });
});
