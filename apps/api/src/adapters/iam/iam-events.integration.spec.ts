import { randomUUID } from "node:crypto";

import {
  AcceptAuditEntryUseCase,
  AuditAcceptanceEventHandler,
  AuditApplication,
  AuditIntegrationEventHandler,
} from "@architecture/audit/application";
import { KyselyAuditRepositoryAdapter } from "@architecture/audit-persistence-kysely";
import { UserEntity } from "@architecture/iam/domain";
import {
  KyselyAccountDeletionAdapter,
  KyselyIamUnitOfWorkAdapter,
  KyselyUserAdapter,
} from "@architecture/iam-persistence-kysely";
import {
  IntegrationEventRouter,
  OutboxWorker,
} from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";
import {
  KyselyOutboxRepositoryAdapter,
  KyselyOutboxWriterAdapter,
} from "@architecture/messaging-persistence-kysely";
import {
  DeliverPendingNotificationsUseCase,
  MarkNotificationReadUseCase,
  NotificationEventHandlerUseCase,
} from "@architecture/notifications/application";
import {
  type NotificationChannelType,
  type NotificationDeliveryAudience,
  NotificationEntity,
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import {
  KyselyNotificationPreferenceRepositoryAdapter,
  KyselyNotificationRepositoryAdapter,
} from "@architecture/notifications-persistence-kysely";
import { KyselyIamNotificationRecipientDirectoryAdapter } from "@architecture/notifications-recipient-iam-kysely";
import { Kysely, PostgresDialect, sql } from "kysely";
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

import { Sha256AuditPseudonymizerAdapter } from "#adapters/audit/sha256-audit-pseudonymizer.adapter";
import { getAllMigrations } from "#app/scripts/migrations.provider";
import type { AppDatabase } from "#composition-root/database.module";

const databaseUrl = process.env["IAM_INTEGRATION_DATABASE_URL"];
const redisUrl = process.env["IAM_INTEGRATION_REDIS_URL"];
if (Boolean(databaseUrl) !== Boolean(redisUrl)) {
  throw new Error("Both IAM integration URLs are required");
}

describe.skipIf(!databaseUrl || !redisUrl)(
  "IAM event PostgreSQL boundaries",
  () => {
    const schema = `iam_event_${randomUUID().replaceAll("-", "")}`;
    let db: Kysely<AppDatabase>, admin: Pool;
    let outbox: KyselyOutboxRepositoryAdapter,
      writer: KyselyOutboxWriterAdapter;
    let notifications: KyselyNotificationRepositoryAdapter;

    beforeAll(async () => {
      if (
        !databaseUrl ||
        !new URL(databaseUrl).pathname.slice(1).startsWith("iam_refactor_test")
      ) {
        throw new Error("A dedicated IAM test database is required");
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
      const result = await new Migrator({
        db,
        migrationTableSchema: schema,
        provider: { getMigrations: async () => getAllMigrations() },
      }).migrateToLatest();
      if (result.error) {
        throw result.error;
      }
      outbox = new KyselyOutboxRepositoryAdapter(db as never);
      writer = new KyselyOutboxWriterAdapter(db as never);
      notifications = new KyselyNotificationRepositoryAdapter(db as never);
    }, 30000);
    afterAll(async () => {
      if (db) {
        await db.destroy();
      }
      if (admin) {
        await admin.query(`drop schema if exists "${schema}" cascade`);
        await admin.end();
      }
    });
    beforeEach(async () => {
      vi.restoreAllMocks();
      await db.deleteFrom("notification_deliveries").execute();
      await db.deleteFrom("notifications").execute();
      await db.deleteFrom("notification_consumptions").execute();
      await db.deleteFrom("notification_preferences").execute();
      await db.deleteFrom("messaging_outbox").execute();
      await db.deleteFrom("audit_events").execute();
      await db.deleteFrom("audit_deleted_subjects").execute();
      await db.deleteFrom("iam_account_erasure_evidence").execute();
      await db.deleteFrom("iam_users").execute();
    });

    function event(): IntegrationEvent {
      const userId = randomUUID();
      return {
        eventId: randomUUID(),
        topic: "iam.user-password-changed",
        version: 1,
        aggregateId: userId,
        occurredAt: new Date(),
        payload: { userId },
        context: { actorType: "user", actorId: userId, subjectId: userId },
      };
    }

    it("minimizes only the deleted account and prevents concurrent or delayed facts from restoring its references", async () => {
      const repository = new KyselyAuditRepositoryAdapter(db as never);
      const pseudonymizer = new Sha256AuditPseudonymizerAdapter();
      const audit = new AuditApplication(repository, pseudonymizer);
      const actorId = randomUUID(),
        subjectId = randomUUID(),
        firstId = randomUUID();
      const input = {
        type: "iam.user-role-changed",
        result: "success" as const,
        context: { actorType: "administrator" as const, actorId, subjectId },
        metadata: {
          actorId,
          userId: subjectId,
          role: "user",
          nested: { reason: `changed by ${actorId}` },
        },
        retentionDays: 365,
      };
      await audit.record({ ...input, id: firstId });
      const reference = pseudonymizer.reference(actorId);
      const deletion = {
        eventId: randomUUID(),
        topic: "account.deletion.executed",
        version: 1,
        aggregateId: reference,
        occurredAt: new Date(),
        payload: { pseudonymousSubject: reference },
        context: { actorType: "system" },
      };
      const handler = new AuditIntegrationEventHandler(audit, {
        getRetentionDays: async () => 365,
      });
      await Promise.all([
        handler.handle(deletion),
        audit.record({ ...input, id: randomUUID() }),
      ]);
      await audit.record({ ...input, id: randomUUID() });
      await handler.handle(deletion);
      const rows = await db
        .selectFrom("audit_events")
        .selectAll()
        .where("type", "=", input.type)
        .execute();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.actor_id).toBeNull();
        expect(row.subject_id).toBe(subjectId);
        expect(JSON.stringify(row.metadata)).not.toContain(actorId);
        expect(row.metadata).toMatchObject({
          actorId: reference,
          userId: subjectId,
          role: "user",
          nested: { reason: `changed by ${reference}` },
        });
      }
      expect(
        await db.selectFrom("audit_deleted_subjects").selectAll().execute(),
      ).toHaveLength(1);
    });

    it("recovers accepted Audit events after storage failure and does not duplicate them", async () => {
      const repository = new KyselyAuditRepositoryAdapter(db as never),
        audit = new AuditApplication(
          repository,
          new Sha256AuditPseudonymizerAdapter(),
        );
      const acceptance = new AcceptAuditEntryUseCase(
        writer,
        new Sha256AuditPseudonymizerAdapter(),
      );
      const eventId = randomUUID(),
        userId = randomUUID();
      await acceptance.record({
        id: eventId,
        type: "authentication.signin",
        result: "success",
        context: { actorType: "user", actorId: userId, subjectId: userId },
        retentionDays: 365,
      });
      const handler = new AuditAcceptanceEventHandler(audit);
      const append = vi
        .spyOn(repository, "append")
        .mockRejectedValueOnce(new Error("Audit storage unavailable"));
      const worker = new OutboxWorker(
        outbox,
        new IntegrationEventRouter([handler]),
        { error: vi.fn() },
      );
      await worker.drain();
      expect(
        await db.selectFrom("audit_events").selectAll().execute(),
      ).toHaveLength(0);
      await db
        .updateTable("messaging_outbox")
        .set({ available_at: new Date(0) })
        .execute();
      await worker.drain();
      expect(
        await db.selectFrom("audit_events").selectAll().execute(),
      ).toHaveLength(1);
      expect(append).toHaveBeenCalledTimes(2);
      const accepted = await db
        .selectFrom("messaging_outbox")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(accepted.status).toBe("published");
      await acceptance.record({
        id: eventId,
        type: "authentication.signin",
        result: "success",
        context: { actorType: "user", actorId: userId },
        retentionDays: 365,
      });
      expect(
        await db.selectFrom("messaging_outbox").selectAll().execute(),
      ).toHaveLength(1);
    });

    it("purges expired evidence while retaining legal holds and rejects resurrection by an expired fact", async () => {
      const audit = new AuditApplication(
        new KyselyAuditRepositoryAdapter(db as never),
        new Sha256AuditPseudonymizerAdapter(),
      );
      const expiredId = randomUUID(),
        heldId = randomUUID();
      for (const id of [expiredId, heldId]) {
        await audit.record({
          id,
          type: "test.retention",
          result: "success",
          context: { actorType: "system" },
          retentionDays: 1,
        });
      }
      await db
        .updateTable("audit_events")
        .set({ expires_at: new Date(0) })
        .execute();
      await db
        .updateTable("audit_events")
        .set({ legal_hold: true })
        .where("id", "=", heldId)
        .execute();
      expect(await audit.purge()).toBe(1);
      expect(
        (await db.selectFrom("audit_events").select("id").execute()).map(
          (row) => row.id,
        ),
      ).toEqual([heldId]);
      await audit.record({
        id: expiredId,
        type: "test.retention",
        result: "success",
        context: { actorType: "system" },
        retentionDays: 1,
        occurredAt: new Date(0),
      });
      expect(
        await db.selectFrom("audit_events").selectAll().execute(),
      ).toHaveLength(1);
    });

    it("keeps SQL retry delays aligned with the core policy for every attempt", async () => {
      const fact = event();
      await writer.append([fact]);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await db
          .updateTable("messaging_outbox")
          .set({ available_at: new Date(0) })
          .execute();
        const claim = await outbox.claim();
        if (!claim) {
          throw new Error("Missing retry claim");
        }
        const before = await sql<{
          now: Date;
        }>`select clock_timestamp() as now`.execute(db);
        const now = before.rows[0]?.now;
        if (!now) {
          throw new Error("Missing database clock");
        }
        claim.message.markFailed(new Error("test failure"), now);
        const expected = claim.message.availableAt.getTime();
        expect(await outbox.finalize(claim)).toBe(true);
        const row = await db
          .selectFrom("messaging_outbox")
          .selectAll()
          .executeTakeFirstOrThrow();
        expect(Math.abs(row.available_at.getTime() - expected)).toBeLessThan(
          1000,
        );
        expect(row.status).toBe(attempt === 10 ? "dead_letter" : "failed");
      }
    });
    async function createIamRecipient(userId: string, role = "user") {
      const now = new Date();
      await db
        .insertInto("iam_users")
        .values({
          id: userId,
          role,
          status: "active",
          created_at: now,
          updated_at: now,
        } as never)
        .execute();
      await db
        .insertInto("iam_login_identities")
        .values({
          id: randomUUID(),
          user_id: userId,
          kind: "email",
          normalized_value: `${userId}@example.test`,
          verification_status: "verified",
          verified_at: now,
          created_at: now,
          updated_at: now,
        } as never)
        .execute();
    }
    function accountDeletionStore() {
      return new KyselyAccountDeletionAdapter(
        db as never,
        (transaction) => new KyselyOutboxWriterAdapter(transaction as never),
      );
    }

    function recipientDirectory() {
      const eligibility = accountDeletionStore();
      return new KyselyIamNotificationRecipientDirectoryAdapter(
        db as never,
        (userId) => eligibility.readAffectedUserDeliveryEligibility(userId),
      );
    }

    async function claimDeliveryForEligibility() {
      const claim = await notifications.claimDelivery();
      if (!claim || !("recipientId" in claim)) {
        throw new Error("Expected an affected-user eligibility reservation");
      }
      return claim;
    }

    async function claimDeliveryWithEligibleRecipient() {
      const claim = await notifications.claimDelivery();
      return claim && "recipientId" in claim
        ? notifications.resolveDeliveryEligibility(claim, "eligible")
        : claim;
    }

    function recipientHandler(
      channels: readonly NotificationChannelType[] = ["email", "slack"],
    ) {
      return new NotificationEventHandlerUseCase(
        notifications,
        new KyselyNotificationPreferenceRepositoryAdapter(db as never),
        recipientDirectory(),
        channels.map((channel) => ({ channel, send: vi.fn() })),
      );
    }
    function snapshot(
      fact: IntegrationEvent,
      deliveries: readonly {
        channel: NotificationChannelType;
        destination: string;
        audience?: NotificationDeliveryAudience;
      }[],
      recipientId = fact.aggregateId,
    ) {
      const severity = NotificationSeverityValueObject.create("warning");
      if (!severity.success) {
        throw new Error("Invalid fixture");
      }
      return NotificationEntity.create({
        recipientId,
        sourceEventId: fact.eventId,
        type: fact.topic,
        severity: severity.value,
        title: "Test",
        message: "Test",
        deliveries: deliveries.map((delivery) => ({
          ...delivery,
          audience: delivery.audience ?? "affected_user",
        })),
      });
    }

    it.each(["user", "suspended"])(
      "suppresses an accepted alert after administrator eligibility changes to %s",
      async (change) => {
        const fact = { ...event(), topic: "iam.user-role-changed" };
        await createIamRecipient(fact.aggregateId, "admin");
        const handler = recipientHandler();
        await handler.handle(fact);
        await db
          .updateTable("notifications")
          .set({ read_at: new Date() })
          .execute();
        const before = await db
          .selectFrom("notifications")
          .selectAll()
          .execute();
        await db
          .updateTable("iam_users")
          .set(change === "user" ? { role: "user" } : { status: "suspended" })
          .where("id", "=", fact.aggregateId)
          .execute();
        const email = vi.fn(),
          slack = vi.fn();
        await new DeliverPendingNotificationsUseCase(
          notifications,
          [
            { channel: "email", send: email },
            { channel: "slack", send: slack },
          ],
          recipientDirectory(),
        ).execute();
        expect(email).toHaveBeenCalledOnce();
        expect(slack).not.toHaveBeenCalled();
        const rows = await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .execute();
        expect(rows.find((row) => row.channel === "slack")).toMatchObject({
          status: "suppressed",
          audience: "administrator",
          suppression_reason: "administrator_not_authorized",
          attempts: 1,
        });
        expect(
          await db.selectFrom("notifications").selectAll().execute(),
        ).toEqual(before);
        await handler.handle(fact);
        expect(await claimDeliveryWithEligibleRecipient()).toBeNull();
        expect(
          await db.selectFrom("notification_deliveries").selectAll().execute(),
        ).toEqual(rows);
      },
    );

    it("fences suppression by an expired delivery owner", async () => {
      const fact = event();
      await notifications.createForEvent(fact.eventId, [
        snapshot(fact, [
          { channel: "email", destination: "user@example.test" },
        ]),
      ]);
      const claim = await claimDeliveryWithEligibleRecipient();
      if (!claim) {
        throw new Error("Missing claim");
      }
      await db
        .updateTable("notification_deliveries")
        .set({ claimed_at: new Date(0) })
        .execute();
      claim.delivery.suppress("administrator_not_authorized");
      expect(await notifications.finalizeDelivery(claim)).toBe(false);
      expect(
        (
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .executeTakeFirstOrThrow()
        ).status,
      ).toBe("processing");
    });

    it("does not schedule another email when a consumed fact is replayed after a verified address change", async () => {
      const fact = event();
      await createIamRecipient(fact.aggregateId);
      const handler = new NotificationEventHandlerUseCase(
        notifications,
        {
          find: async () => null,
          save: async () => undefined,
          listForRecipient: async () => [],
        },
        recipientDirectory(),
        [{ channel: "email", send: vi.fn() }],
      );
      await handler.handle(fact);
      const claim = await claimDeliveryWithEligibleRecipient();
      if (!claim) {
        throw new Error("Missing email delivery");
      }
      claim.delivery.markSent();
      expect(await notifications.finalizeDelivery(claim)).toBe(true);
      const before = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .execute();
      await db
        .updateTable("iam_login_identities")
        .set({ normalized_value: `new-${fact.aggregateId}@example.test` })
        .where("user_id", "=", fact.aggregateId)
        .execute();
      await handler.handle(fact);
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toHaveLength(1);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toEqual(before);
    });

    it.each([
      "enable preference",
      "disable preference",
      "enable channel",
      "remove channel",
    ])("keeps the accepted delivery set after replay: %s", async (change) => {
      const fact = { ...event(), topic: "iam.user-registered" };
      await createIamRecipient(fact.aggregateId);
      await db
        .insertInto("notification_preferences")
        .values({
          user_id: fact.aggregateId,
          channel: "email",
          enabled: change !== "enable preference",
          updated_at: new Date(),
        })
        .execute();
      await recipientHandler(
        change === "enable channel" ? [] : ["email"],
      ).handle(fact);
      const before = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .execute();
      await db
        .updateTable("notification_preferences")
        .set({ enabled: change !== "disable preference" })
        .where("user_id", "=", fact.aggregateId)
        .execute();
      await recipientHandler(
        change === "remove channel" ? [] : ["email"],
      ).handle(fact);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toEqual(before);
      expect(await notifications.hasConsumedEvent(fact.eventId)).toBe(true);
    });

    it("records an empty recipient selection so later IAM changes do not backfill an old fact", async () => {
      const fact = event();
      await recipientHandler().handle(fact);
      expect(await notifications.hasConsumedEvent(fact.eventId)).toBe(true);
      await createIamRecipient(fact.aggregateId);
      await recipientHandler().handle(fact);
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toHaveLength(0);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toHaveLength(0);
    });

    it("composes user/admin channels once and does not add newly eligible administrators on replay", async () => {
      const fact = { ...event(), topic: "iam.user-role-changed" };
      const otherAdministratorId = randomUUID();
      await createIamRecipient(fact.aggregateId, "admin");
      await createIamRecipient(otherAdministratorId, "admin");
      await Promise.all([
        recipientHandler().handle(fact),
        recipientHandler().handle(fact),
      ]);
      const rows = await db.selectFrom("notifications").selectAll().execute();
      expect(rows).toHaveLength(2);
      const subject = rows.find((row) => row.recipient_id === fact.aggregateId);
      expect(subject).toBeDefined();
      const deliveries = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .execute();
      expect(
        deliveries
          .filter((row) => row.notification_id === subject?.id)
          .map((row) => row.channel)
          .sort(),
      ).toEqual(["email", "slack"]);
      expect(deliveries).toHaveLength(3);
      await createIamRecipient(randomUUID(), "admin");
      await recipientHandler().handle(fact);
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toEqual(rows);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toEqual(deliveries);
    });

    it("commits one complete snapshot when different channels and destinations race", async () => {
      const fact = event();
      const first = snapshot(fact, [
        { channel: "email", destination: "old@example.test" },
        { channel: "sms", destination: "old-phone" },
      ]);
      const second = snapshot(fact, [
        { channel: "email", destination: "new@example.test" },
        { channel: "slack", destination: "security" },
      ]);
      await Promise.all([
        notifications.createForEvent(fact.eventId, [first]),
        notifications.createForEvent(fact.eventId, [second]),
      ]);
      const rows = await db.selectFrom("notifications").selectAll().execute();
      expect(rows).toHaveLength(1);
      const winner = rows[0]?.id === first.identifier.value ? first : second;
      const deliveries = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .orderBy("channel")
        .execute();
      expect(
        deliveries.map(({ channel, destination }) => ({
          channel,
          destination,
        })),
      ).toEqual(
        winner.deliveries
          .map((delivery) => ({
            channel: delivery.channel.value,
            destination: delivery.destination,
          }))
          .sort((a, b) => a.channel.localeCompare(b.channel)),
      );
      expect(
        await db.selectFrom("notification_consumptions").selectAll().execute(),
      ).toHaveLength(1);
      const before = deliveries;
      await notifications.createForEvent(fact.eventId, [
        second,
        snapshot(
          fact,
          [{ channel: "sms", destination: "new-phone" }],
          randomUUID(),
        ),
      ]);
      expect(
        await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .orderBy("channel")
          .execute(),
      ).toEqual(before);
    });

    it("rolls back consumption and earlier recipients when a later delivery insert fails", async () => {
      const fact = event();
      const otherRecipient = randomUUID();
      const first = snapshot(fact, [
        {
          channel: "email",
          destination: "user@example.test",
          audience: "affected_user",
        },
      ]);
      const invalid = snapshot(
        fact,
        [{ channel: "slack", destination: "x".repeat(513) }],
        otherRecipient,
      );
      await expect(
        notifications.createForEvent(fact.eventId, [first, invalid]),
      ).rejects.toThrow("character varying");
      expect(await notifications.hasConsumedEvent(fact.eventId)).toBe(false);
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toHaveLength(0);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toHaveLength(0);
      await notifications.createForEvent(fact.eventId, [
        first,
        snapshot(
          fact,
          [{ channel: "slack", destination: "security" }],
          otherRecipient,
        ),
      ]);
      expect(await notifications.hasConsumedEvent(fact.eventId)).toBe(true);
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toHaveLength(2);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toHaveLength(2);
    });

    it("rejects a mismatched fact without recording consumption", async () => {
      const fact = event();
      await expect(
        notifications.createForEvent(randomUUID(), [snapshot(fact, [])]),
      ).rejects.toThrow("source event");
      expect(
        await db.selectFrom("notification_consumptions").selectAll().execute(),
      ).toHaveLength(0);
    });

    it("keeps an inconsistent pre-existing notification explicit instead of recording false success", async () => {
      const fact = event();
      const original = snapshot(fact, [
        { channel: "email", destination: "old@example.test" },
      ]);
      await notifications.createForEvent(fact.eventId, [original]);
      // Simulate inconsistent imported data in this disposable schema, not a supported upgrade path.
      await db
        .deleteFrom("notification_consumptions")
        .where("source_event_id", "=", fact.eventId)
        .execute();
      await expect(
        notifications.createForEvent(fact.eventId, [
          snapshot(fact, [
            { channel: "email", destination: "new@example.test" },
          ]),
        ]),
      ).rejects.toThrow("notifications_source_recipient_unique");
      expect(await notifications.hasConsumedEvent(fact.eventId)).toBe(false);
      expect(
        await db
          .selectFrom("notification_deliveries")
          .select("destination")
          .execute(),
      ).toEqual([{ destination: "old@example.test" }]);
    });

    it.each(["downstream failure", "lost finalization"])(
      "retries the real outbox without changing accepted notification effects after %s",
      async (failure) => {
        const fact = event();
        await createIamRecipient(fact.aggregateId);
        const audit = new AuditIntegrationEventHandler(
          new AuditApplication(
            new KyselyAuditRepositoryAdapter(db as never),
            new Sha256AuditPseudonymizerAdapter(),
          ),
          { getRetentionDays: async () => 365 },
        );
        if (failure === "downstream failure") {
          vi.spyOn(audit, "handle").mockRejectedValueOnce(
            new Error("temporary Audit failure"),
          );
        } else {
          vi.spyOn(outbox, "finalize").mockResolvedValueOnce(false);
        }
        const worker = new OutboxWorker(
          outbox,
          new IntegrationEventRouter([recipientHandler(), audit]),
          { error: vi.fn() },
        );
        await writer.append([fact]);
        expect(await worker.drain(1)).toBe(1);
        expect(
          (
            await db
              .selectFrom("messaging_outbox")
              .selectAll()
              .executeTakeFirstOrThrow()
          ).status,
        ).toBe(failure === "downstream failure" ? "failed" : "processing");
        const email = await claimDeliveryWithEligibleRecipient();
        if (!email) {
          throw new Error("Missing email");
        }
        email.delivery.markSent();
        expect(await notifications.finalizeDelivery(email)).toBe(true);
        await notifications.markAllRead(fact.aggregateId);
        await db
          .updateTable("notifications")
          .set({ archived_at: new Date() })
          .execute();
        const notificationRows = await db
          .selectFrom("notifications")
          .selectAll()
          .execute();
        const deliveryRows = await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .execute();
        await db
          .updateTable("iam_login_identities")
          .set({ normalized_value: `new-${fact.aggregateId}@example.test` })
          .where("user_id", "=", fact.aggregateId)
          .execute();
        if (failure === "lost finalization") {
          await expireOutbox(fact.eventId);
          await outbox.recoverStale();
        }
        await dueOutbox();
        expect(await worker.drain(1)).toBe(1);
        expect(
          await db
            .selectFrom("messaging_outbox")
            .selectAll()
            .executeTakeFirstOrThrow(),
        ).toMatchObject({ status: "published", attempts: 2 });
        expect(
          await db.selectFrom("audit_events").selectAll().execute(),
        ).toHaveLength(1);
        expect(
          await db.selectFrom("notifications").selectAll().execute(),
        ).toEqual(notificationRows);
        expect(
          await db.selectFrom("notification_deliveries").selectAll().execute(),
        ).toEqual(deliveryRows);
      },
    );

    it("retries only the existing failed channel after replay, preserving sent and acknowledgement state", async () => {
      const fact = { ...event(), topic: "iam.user-role-changed" };
      await createIamRecipient(fact.aggregateId, "admin");
      await recipientHandler().handle(fact);
      const claims = await Promise.all([
        claimDeliveryWithEligibleRecipient(),
        claimDeliveryWithEligibleRecipient(),
      ]);
      const email = claims.find(
        (claim) => claim?.delivery.channel.value === "email",
      );
      const slack = claims.find(
        (claim) => claim?.delivery.channel.value === "slack",
      );
      if (!email || !slack) {
        throw new Error("Missing independent channels");
      }
      email.delivery.markSent();
      slack.delivery.markFailed(new Error("provider unavailable"));
      expect(await notifications.finalizeDelivery(email)).toBe(true);
      expect(await notifications.finalizeDelivery(slack)).toBe(true);
      await notifications.markAllRead(fact.aggregateId);
      await db
        .updateTable("notifications")
        .set({ archived_at: new Date() })
        .execute();
      const notificationRows = await db
        .selectFrom("notifications")
        .selectAll()
        .execute();
      const deliveries = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .orderBy("id")
        .execute();
      await db
        .updateTable("iam_login_identities")
        .set({ normalized_value: `new-${fact.aggregateId}@example.test` })
        .where("user_id", "=", fact.aggregateId)
        .execute();
      await recipientHandler().handle(fact);
      expect(
        await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .orderBy("id")
          .execute(),
      ).toEqual(deliveries);
      await db
        .updateTable("notification_deliveries")
        .set({ available_at: new Date(0) })
        .where("id", "=", slack.delivery.identifier.value)
        .execute();
      const retry = await claimDeliveryWithEligibleRecipient();
      if (!retry) {
        throw new Error("Missing retry");
      }
      expect(retry.delivery.identifier.value).toBe(
        slack.delivery.identifier.value,
      );
      expect(retry.delivery.destination).toBe(slack.delivery.destination);
      expect(retry.delivery.attempts).toBe(2);
      retry.delivery.markSent();
      expect(await notifications.finalizeDelivery(retry)).toBe(true);
      expect(await claimDeliveryWithEligibleRecipient()).toBeNull();
      expect(
        await db.selectFrom("notifications").selectAll().execute(),
      ).toEqual(notificationRows);
      expect(
        await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .where("id", "=", email.delivery.identifier.value)
          .executeTakeFirstOrThrow(),
      ).toEqual(
        deliveries.find(
          (delivery) => delivery.id === email.delivery.identifier.value,
        ),
      );
    });

    it("does not replace an active delivery claim when a different snapshot is replayed", async () => {
      const { fact, make } = await notification();
      const claim = await claimDeliveryWithEligibleRecipient();
      if (!claim) {
        throw new Error("Missing active delivery");
      }
      const before = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .orderBy("id")
        .execute();
      await notifications.createForEvent(fact.eventId, [
        snapshot(fact, [{ channel: "email", destination: "new@example.test" }]),
      ]);
      expect(
        await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .orderBy("id")
          .execute(),
      ).toEqual(before);
      claim.delivery.markSent();
      expect(await notifications.finalizeDelivery(claim)).toBe(true);
      await notifications.createForEvent(fact.eventId, [make()]);
    });
    async function notification() {
      const fact = event(),
        severity = NotificationSeverityValueObject.create("warning");
      if (!severity.success) {
        throw new Error("Invalid fixture");
      }
      const make = () =>
        NotificationEntity.create({
          recipientId: fact.aggregateId,
          sourceEventId: fact.eventId,
          type: fact.topic,
          severity: severity.value,
          title: "Test",
          message: "Test",
          deliveries: [
            {
              channel: "email",
              destination: "user@example.test",
              audience: "affected_user",
            },
            {
              channel: "sms",
              destination: "test-destination",
              audience: "affected_user",
            },
          ],
        });
      await Promise.all([
        notifications.createForEvent(fact.eventId, [make()]),
        notifications.createForEvent(fact.eventId, [make()]),
      ]);
      return { fact, make };
    }
    async function expireOutbox(id: string) {
      await db
        .updateTable("messaging_outbox")
        .set({
          claimed_at: sql<Date>`clock_timestamp() - interval '6 minutes'`,
        })
        .where("id", "=", id)
        .execute();
    }
    async function dueOutbox() {
      await db
        .updateTable("messaging_outbox")
        .set({
          available_at: sql<Date>`clock_timestamp() - interval '1 second'`,
        })
        .where("status", "=", "failed")
        .execute();
    }
    async function expireDeliveries() {
      await db
        .updateTable("notification_deliveries")
        .set({
          claimed_at: sql<Date>`clock_timestamp() - interval '6 minutes'`,
        })
        .where("status", "=", "processing")
        .execute();
    }

    it("skips a row locked by another transaction and never claims a message twice", async () => {
      const first = event(),
        second = event();
      await writer.append([first, second]);
      await db.transaction().execute(async (trx) => {
        await trx
          .selectFrom("messaging_outbox")
          .selectAll()
          .where("id", "=", first.eventId)
          .forUpdate()
          .execute();
        const claim = await outbox.claim();
        expect(claim?.message.event.eventId).toBe(second.eventId);
      });
      const claims = await Promise.all([outbox.claim(), outbox.claim()]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(claims.find(Boolean)?.message.event.eventId).toBe(first.eventId);
    });

    it.each([true, false])(
      "fences expired outbox owners after replacement (new success=%s)",
      async (success) => {
        const fact = event();
        await writer.append([fact]);
        const old = await outbox.claim();
        if (!old) {
          throw new Error("Missing claim");
        }
        await expireOutbox(fact.eventId);
        // Expiry alone, even before reassignment, revokes finalization authority.
        if (success) {
          old.message.markFailed(new Error("late failure"));
        } else {
          old.message.markPublished();
        }
        expect(await outbox.finalize(old)).toBe(false);
        await outbox.recoverStale();
        const recovered = await db
          .selectFrom("messaging_outbox")
          .selectAll()
          .where("id", "=", fact.eventId)
          .executeTakeFirstOrThrow();
        expect(recovered.available_at.getTime()).toBeGreaterThan(Date.now());
        await dueOutbox();
        const current = await outbox.claim();
        if (!current) {
          throw new Error("Missing replacement");
        }
        expect(current.claimToken).not.toBe(old.claimToken);
        expect(await outbox.finalize(old)).toBe(false);
        expect(
          await db
            .selectFrom("messaging_outbox")
            .selectAll()
            .where("id", "=", fact.eventId)
            .executeTakeFirstOrThrow(),
        ).toMatchObject({
          status: "processing",
          claim_token: current.claimToken,
          attempts: 2,
        });
        if (success) {
          current.message.markPublished();
        } else {
          current.message.markFailed(new Error("new failure"));
        }
        expect(await outbox.finalize(current)).toBe(true);
        expect(await outbox.finalize(old)).toBe(false);
        expect(
          (
            await db
              .selectFrom("messaging_outbox")
              .selectAll()
              .where("id", "=", fact.eventId)
              .executeTakeFirstOrThrow()
          ).status,
        ).toBe(success ? "published" : "failed");
      },
    );

    it.each([true, false])(
      "counts outbox claims once through finalization (success=%s)",
      async (success) => {
        const fact = event();
        await writer.append([fact]);
        expect(
          await db
            .selectFrom("messaging_outbox")
            .selectAll()
            .where("id", "=", fact.eventId)
            .executeTakeFirstOrThrow(),
        ).toMatchObject({ status: "pending", attempts: 0 });

        const limit = success ? 1 : 10;
        for (let attempt = 1; attempt <= limit; attempt++) {
          const claim = await outbox.claim();
          if (!claim) {
            throw new Error("Missing claim");
          }
          expect(claim.message.attempts).toBe(attempt);
          if (success) {
            claim.message.markPublished();
          } else {
            claim.message.markFailed(new Error("provider unavailable"));
          }
          expect(claim.message.attempts).toBe(attempt);
          expect(await outbox.finalize(claim)).toBe(true);
          expect(
            await db
              .selectFrom("messaging_outbox")
              .selectAll()
              .where("id", "=", fact.eventId)
              .executeTakeFirstOrThrow(),
          ).toMatchObject({
            attempts: attempt,
            status: success
              ? "published"
              : attempt === 10
                ? "dead_letter"
                : "failed",
          });
          await dueOutbox();
        }
        expect(await outbox.claim()).toBeNull();
      },
    );

    it("dead-letters ten abandoned outbox attempts", async () => {
      const fact = event();
      await writer.append([fact]);
      for (let attempt = 1; attempt <= 10; attempt++) {
        const claim = await outbox.claim();
        expect(claim?.message.attempts).toBe(attempt);
        await expireOutbox(fact.eventId);
        await outbox.recoverStale();
        expect(
          await db
            .selectFrom("messaging_outbox")
            .selectAll()
            .where("id", "=", fact.eventId)
            .executeTakeFirstOrThrow(),
        ).toMatchObject({
          attempts: attempt,
          status: attempt === 10 ? "dead_letter" : "failed",
        });
        await dueOutbox();
      }
      expect(await outbox.claim()).toBeNull();
      expect(
        (
          await db
            .selectFrom("messaging_outbox")
            .selectAll()
            .executeTakeFirstOrThrow()
        ).status,
      ).toBe("dead_letter");
    });

    it.each(["individual", "all"])(
      "finalizes channels and preserves %s acknowledgement/archive on replay",
      async (acknowledgement) => {
        const { fact, make } = await notification();
        const claims = await Promise.all([
          claimDeliveryWithEligibleRecipient(),
          claimDeliveryWithEligibleRecipient(),
        ]);
        const [first, second] = claims;
        if (!first || !second) {
          throw new Error("Missing channels");
        }
        expect(first.delivery.identifier.value).not.toBe(
          second.delivery.identifier.value,
        );
        if (acknowledgement === "all") {
          await notifications.markAllRead(fact.aggregateId);
        } else {
          expect(
            await new MarkNotificationReadUseCase(notifications).execute({
              actorUserId: fact.aggregateId,
              notificationId: first.notification.identifier.value,
            }),
          ).toEqual({ success: true, value: undefined });
        }
        await db
          .updateTable("notifications")
          .set({ archived_at: new Date() })
          .where("recipient_id", "=", fact.aggregateId)
          .execute();
        first.delivery.markSent();
        second.delivery.markFailed(new Error("provider down"));
        expect(await notifications.finalizeDelivery(first)).toBe(true);
        expect(await notifications.finalizeDelivery(second)).toBe(true);
        await notifications.createForEvent(fact.eventId, [make()]);
        const rows = await db.selectFrom("notifications").selectAll().execute();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.read_at).not.toBeNull();
        expect(rows[0]?.archived_at).not.toBeNull();
        const deliveries = await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .execute();
        expect(deliveries).toHaveLength(2);
        expect(deliveries.map((d) => d.status).sort()).toEqual([
          "failed",
          "sent",
        ]);
        expect(deliveries.map((delivery) => delivery.attempts)).toEqual([1, 1]);
      },
    );

    it.each([true, false])(
      "fences stale delivery finalization (new success=%s)",
      async (success) => {
        await notification();
        const old = await claimDeliveryWithEligibleRecipient();
        if (!old) {
          throw new Error("Missing delivery");
        }
        await expireDeliveries();
        if (success) {
          old.delivery.markFailed(new Error("late"));
        } else {
          old.delivery.markSent();
        }
        expect(await notifications.finalizeDelivery(old)).toBe(false);
        await notifications.recoverStaleDeliveries();
        await db
          .updateTable("notification_deliveries")
          .set({ available_at: new Date(0) })
          .execute();
        // Restrict this scenario to the reclaimed channel.
        await db
          .deleteFrom("notification_deliveries")
          .where("id", "!=", old.delivery.identifier.value)
          .execute();
        const current = await claimDeliveryWithEligibleRecipient();
        if (!current) {
          throw new Error("Missing replacement");
        }
        expect(current.claimToken).not.toBe(old.claimToken);
        expect(await notifications.finalizeDelivery(old)).toBe(false);
        expect(
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .where("id", "=", current.delivery.identifier.value)
            .executeTakeFirstOrThrow(),
        ).toMatchObject({
          status: "processing",
          claim_token: current.claimToken,
          attempts: 2,
        });
        if (success) {
          current.delivery.markSent();
        } else {
          current.delivery.markFailed(new Error("new failure"));
        }
        expect(await notifications.finalizeDelivery(current)).toBe(true);
        expect(await notifications.finalizeDelivery(old)).toBe(false);
        expect(
          (
            await db
              .selectFrom("notification_deliveries")
              .selectAll()
              .executeTakeFirstOrThrow()
          ).status,
        ).toBe(success ? "sent" : "failed");
      },
    );

    it.each([true, false])(
      "counts delivery claims once through finalization (success=%s)",
      async (success) => {
        await notification();
        await db
          .deleteFrom("notification_deliveries")
          .where("channel", "!=", "email")
          .execute();
        expect(
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .executeTakeFirstOrThrow(),
        ).toMatchObject({ status: "pending", attempts: 0 });

        const limit = success ? 1 : 10;
        for (let attempt = 1; attempt <= limit; attempt++) {
          const claim = await claimDeliveryWithEligibleRecipient();
          if (!claim) {
            throw new Error("Missing delivery");
          }
          expect(claim.delivery.attempts).toBe(attempt);
          if (success) {
            claim.delivery.markSent();
          } else {
            claim.delivery.markFailed(new Error("provider unavailable"));
          }
          expect(claim.delivery.attempts).toBe(attempt);
          expect(await notifications.finalizeDelivery(claim)).toBe(true);
          expect(
            await db
              .selectFrom("notification_deliveries")
              .selectAll()
              .where("id", "=", claim.delivery.identifier.value)
              .executeTakeFirstOrThrow(),
          ).toMatchObject({
            attempts: attempt,
            status: success
              ? "sent"
              : attempt === 10
                ? "dead_letter"
                : "failed",
          });
          await db
            .updateTable("notification_deliveries")
            .set({ available_at: new Date(0) })
            .execute();
        }
        expect(await claimDeliveryWithEligibleRecipient()).toBeNull();
      },
    );

    it.each(["unresolved", "eligible", "erased"] as const)(
      "settles the tenth eligibility reservation as %s independently of provider attempts",
      async (decision) => {
        const fact = event();
        await notifications.createForEvent(fact.eventId, [
          snapshot(fact, [
            { channel: "email", destination: "user@example.test" },
          ]),
        ]);
        for (let checks = 1; checks <= 9; checks++) {
          const claim = await claimDeliveryForEligibility();
          expect(claim).not.toHaveProperty("notification");
          expect(
            await notifications.resolveDeliveryEligibility(claim, "unresolved"),
          ).toBeNull();
          expect(
            await db
              .selectFrom("notification_deliveries")
              .selectAll()
              .executeTakeFirstOrThrow(),
          ).toMatchObject({
            attempts: 0,
            unresolved_eligibility_checks: checks,
            status: "failed",
            destination: "user@example.test",
          });
          await db
            .updateTable("notification_deliveries")
            .set({ available_at: new Date(0) })
            .execute();
        }
        const tenth = await claimDeliveryForEligibility();
        const admitted = await notifications.resolveDeliveryEligibility(
          tenth,
          decision,
        );
        expect(
          await notifications.resolveDeliveryEligibility(tenth, "eligible"),
        ).toBeNull();
        const row = await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .executeTakeFirstOrThrow();
        if (decision === "eligible") {
          expect(admitted?.delivery.attempts).toBe(1);
          expect(row).toMatchObject({
            unresolved_eligibility_checks: 9,
            attempts: 1,
            processing_phase: "provider_admitted",
          });
        } else {
          expect(admitted).toBeNull();
          expect(row).toMatchObject({
            unresolved_eligibility_checks: decision === "erased" ? 9 : 10,
            attempts: 0,
            status: "suppressed",
            suppression_reason:
              decision === "erased"
                ? "account_erased"
                : "eligibility_unverified",
            destination: null,
          });
        }
      },
    );

    it("fences eligibility results after lease expiry and counts abandoned checks once", async () => {
      const fact = event();
      await notifications.createForEvent(fact.eventId, [
        snapshot(fact, [
          { channel: "email", destination: "user@example.test" },
        ]),
      ]);
      const old = await claimDeliveryForEligibility();
      await expireDeliveries();
      expect(
        await notifications.resolveDeliveryEligibility(old, "eligible"),
      ).toBeNull();
      await Promise.all([
        notifications.recoverStaleDeliveries(),
        notifications.recoverStaleDeliveries(),
      ]);
      await db
        .updateTable("notification_deliveries")
        .set({ available_at: new Date(0) })
        .execute();
      const replacement = await claimDeliveryForEligibility();
      expect(replacement.claimToken).not.toBe(old.claimToken);
      expect(
        await notifications.resolveDeliveryEligibility(old, "eligible"),
      ).toBeNull();
      expect(
        await notifications.resolveDeliveryEligibility(replacement, "eligible"),
      ).not.toBeNull();
      expect(
        await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .executeTakeFirstOrThrow(),
      ).toMatchObject({
        attempts: 1,
        unresolved_eligibility_checks: 1,
        claim_token: replacement.claimToken,
      });
    });

    it.each([true, false])(
      "withholds a new attempt after erasure while allowing an already-authorized invocation (%s)",
      async (preauthorized) => {
        const identifier = UserEntity.create().identifier;
        const fact = { ...event(), aggregateId: identifier.value };
        await createIamRecipient(fact.aggregateId, "admin");
        const make = () =>
          snapshot(fact, [
            {
              channel: "email",
              destination: "user@example.test",
              audience: "affected_user_and_administrator",
            },
          ]);
        await notifications.createForEvent(fact.eventId, [make()]);
        await notifications.markAllRead(fact.aggregateId);
        const user = await new KyselyUserAdapter(db as never, writer).findById(
          identifier,
        );
        if (!user) {
          throw new Error("Missing fixture user");
        }
        const store = accountDeletionStore();
        const requestId = randomUUID(),
          now = new Date();
        user.requestDeletion();
        await store.request({
          user,
          previousStatus: "active",
          requireAnotherAdministrator: false,
          id: requestId,
          tokenHash: randomUUID(),
          now,
          scheduledFor: new Date(now.getTime() - 1000),
        });
        const erase = async () => {
          expect(await store.eraseIfDue(requestId, new Date())).not.toBeNull();
        };
        if (preauthorized) {
          const owns = notifications.ownsAuthorizedDelivery.bind(notifications);
          vi.spyOn(
            notifications,
            "ownsAuthorizedDelivery",
          ).mockImplementationOnce(async (claim) => {
            await erase();
            return owns(claim);
          });
        } else {
          await erase();
        }
        const send = vi
          .fn()
          .mockRejectedValue(
            new Error("sensitive detail: test-secret@example.test"),
          );
        const useCase = new DeliverPendingNotificationsUseCase(
          notifications,
          [{ channel: "email", send }],
          recipientDirectory(),
        );
        await useCase.execute();
        if (preauthorized) {
          expect(send).toHaveBeenCalledOnce();
          await db
            .updateTable("notification_deliveries")
            .set({ available_at: new Date(0) })
            .execute();
          await useCase.execute();
        } else {
          expect(send).not.toHaveBeenCalled();
        }
        const terminal = await db
          .selectFrom("notification_deliveries")
          .selectAll()
          .executeTakeFirstOrThrow();
        expect(terminal).toMatchObject({
          status: "suppressed",
          suppression_reason: "account_erased",
          last_provider_outcome: preauthorized ? "unknown" : null,
          attempts: preauthorized ? 1 : 0,
          unresolved_eligibility_checks: 0,
          destination: null,
        });
        expect(JSON.stringify(terminal)).not.toContain(
          "test-secret@example.test",
        );
        await notifications.createForEvent(fact.eventId, [make()]);
        expect(
          await db.selectFrom("notification_deliveries").selectAll().execute(),
        ).toEqual([terminal]);
        expect(
          (
            await db
              .selectFrom("notifications")
              .select("read_at")
              .executeTakeFirstOrThrow()
          ).read_at,
        ).not.toBeNull();
      },
    );

    it.each([true, false])(
      "closes an unused authorization that expires before admission (%s) or handoff",
      async (beforeAdmission) => {
        const fact = event();
        await notifications.createForEvent(fact.eventId, [
          snapshot(fact, [
            { channel: "email", destination: "user@example.test" },
          ]),
        ]);
        const pending = await claimDeliveryForEligibility();
        const admission = await notifications.resolveDeliveryEligibility(
          pending,
          "eligible",
          beforeAdmission ? new Date(0) : undefined,
        );
        if (!beforeAdmission) {
          if (!admission) {
            throw new Error("Expected admission");
          }
          await notifications.expireDeliveryAuthorization(admission);
          expect(await notifications.ownsAuthorizedDelivery(admission)).toBe(
            false,
          );
          admission.delivery.markSent();
          expect(await notifications.finalizeDelivery(admission)).toBe(false);
        } else {
          expect(admission).toBeNull();
        }
        expect(
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .executeTakeFirstOrThrow(),
        ).toMatchObject({
          status: "suppressed",
          suppression_reason: "authorization_expired",
          destination: null,
          attempts: 0,
          unresolved_eligibility_checks: 0,
        });
      },
    );

    it("preserves legacy attempt counts and leaves historical terminal rows alone during upgrade", async () => {
      const legacySchema = `${schema}_legacy`;
      await admin.query(`create schema "${legacySchema}"`);
      const legacyDb = new Kysely<AppDatabase>({
        dialect: new PostgresDialect({
          pool: new Pool({
            connectionString: databaseUrl,
            options: `-c search_path=${legacySchema}`,
          }),
        }),
      });
      try {
        const migrator = new Migrator({
          db: legacyDb,
          migrationTableSchema: legacySchema,
          provider: { getMigrations: async () => getAllMigrations() },
        });
        const baseline = await migrator.migrateTo(
          "009_add_iam_erasure_evidence",
        );
        if (baseline.error) {
          throw baseline.error;
        }
        const notificationId = randomUUID(),
          processingId = randomUUID(),
          sentId = randomUUID();
        await sql`insert into notifications
          (id, recipient_id, source_event_id, type, severity, title, message)
          values (${notificationId}, ${randomUUID()}, ${randomUUID()}, 'test', 'warning', 'Test', 'Test')`.execute(
          legacyDb,
        );
        await sql`insert into notification_deliveries
          (id, notification_id, channel, destination, audience, status, attempts, available_at, claimed_at, claim_token)
          values (${processingId}, ${notificationId}, 'email', 'stranded@example.test', 'affected_user', 'processing', 10,
                    now(), now() - interval '6 minutes', ${randomUUID()}),
                 (${sentId}, ${notificationId}, 'email', 'historical@example.test', 'affected_user', 'sent', 1,
                    now(), null, null)`.execute(legacyDb);
        const upgrade = await migrator.migrateToLatest();
        if (upgrade.error) {
          throw upgrade.error;
        }
        const delivery = (id: string) =>
          legacyDb
            .selectFrom("notification_deliveries")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirstOrThrow();
        expect(await delivery(processingId)).toMatchObject({
          status: "processing",
          attempts: 10,
          unresolved_eligibility_checks: 0,
          processing_phase: "provider_admitted",
        });
        await new KyselyNotificationRepositoryAdapter(
          legacyDb as never,
        ).recoverStaleDeliveries();
        expect(await delivery(processingId)).toMatchObject({
          status: "dead_letter",
          attempts: 10,
          last_provider_outcome: "unknown",
          destination: null,
        });
        expect(await delivery(sentId)).toMatchObject({
          status: "sent",
          attempts: 1,
          destination: "historical@example.test",
        });
      } finally {
        await legacyDb.destroy();
        await admin.query(`drop schema "${legacySchema}" cascade`);
      }
    });

    it("dead-letters ten abandoned deliveries", async () => {
      const { fact, make } = await notification();
      const initial = await claimDeliveryWithEligibleRecipient();
      if (!initial) {
        throw new Error("Missing delivery");
      }
      await db
        .deleteFrom("notification_deliveries")
        .where("id", "!=", initial.delivery.identifier.value)
        .execute();
      for (let attempt = 1; attempt <= 10; attempt++) {
        const claim =
          attempt === 1 ? initial : await claimDeliveryWithEligibleRecipient();
        expect(claim?.delivery.attempts).toBe(attempt);
        await expireDeliveries();
        await notifications.recoverStaleDeliveries();
        expect(
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .where("id", "=", initial.delivery.identifier.value)
            .executeTakeFirstOrThrow(),
        ).toMatchObject({
          attempts: attempt,
          status: attempt === 10 ? "dead_letter" : "failed",
        });
        await db
          .updateTable("notification_deliveries")
          .set({ available_at: new Date(0) })
          .execute();
      }
      expect(await claimDeliveryWithEligibleRecipient()).toBeNull();
      expect(
        (
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .executeTakeFirstOrThrow()
        ).status,
      ).toBe("dead_letter");
      const beforeReplay = await db
        .selectFrom("notification_deliveries")
        .selectAll()
        .execute();
      await notifications.createForEvent(fact.eventId, [make()]);
      expect(
        await db.selectFrom("notification_deliveries").selectAll().execute(),
      ).toEqual(beforeReplay);
    });

    it("replays partial Audit/Notifications dispatch without duplicates or acknowledgement changes", async () => {
      const fact = event(),
        identifier = NotificationRecipientIdentifierValueObject.create(
          fact.aggregateId,
        );
      if (!identifier.success) {
        throw new Error("Invalid fixture");
      }
      const audit = new AuditIntegrationEventHandler(
        new AuditApplication(
          new KyselyAuditRepositoryAdapter(db as never),
          new Sha256AuditPseudonymizerAdapter(),
        ),
        { getRetentionDays: async () => 365 },
      );
      const handler = new NotificationEventHandlerUseCase(
        notifications,
        {
          find: async () => null,
          save: async () => undefined,
          listForRecipient: async () => [],
        },
        {
          findUser: async () =>
            NotificationRecipientEntity.create({
              identifier: identifier.value,
              email: "user@example.test",
              phoneNumber: null,
            }),
          listAdministratorIds: async () => [],
          isActiveAdministrator: async () => false,
          readAffectedUserDeliveryEligibility: async () => "eligible",
        },
        [],
      );
      const router = new IntegrationEventRouter([audit, handler]);
      vi.spyOn(notifications, "createForEvent").mockRejectedValueOnce(
        new Error("temporary consumer failure"),
      );
      await expect(router.dispatch(fact)).rejects.toThrow(
        "temporary consumer failure",
      );
      await router.dispatch(fact);
      await notifications.markAllRead(fact.aggregateId);
      await Promise.all([router.dispatch(fact), router.dispatch(fact)]);
      expect(
        await db.selectFrom("audit_events").selectAll().execute(),
      ).toHaveLength(1);
      const rows = await db.selectFrom("notifications").selectAll().execute();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.read_at).not.toBeNull();
      await expect(router.dispatch({ ...fact, version: 999 })).rejects.toThrow(
        "version",
      );
      expect(
        await db.selectFrom("audit_events").selectAll().execute(),
      ).toHaveLength(1);
    });

    it("rolls back aggregate and outbox together, then retries using fresh aggregate state", async () => {
      const uow = new KyselyIamUnitOfWorkAdapter(
        db as never,
        (trx) => new KyselyOutboxWriterAdapter(trx as never),
      );
      const discarded = UserEntity.create();
      await expect(
        uow.execute(async ({ users }) => {
          await users.save(discarded);
          throw new Error("rollback after append");
        }),
      ).rejects.toThrow("rollback after append");
      expect(
        await db
          .selectFrom("iam_users")
          .selectAll()
          .where("id", "=", discarded.identifier.value)
          .execute(),
      ).toHaveLength(0);
      expect(
        await db.selectFrom("messaging_outbox").selectAll().execute(),
      ).toHaveLength(0);
      // The rolled-back instance has released events and must not be reused.
      expect(discarded.pendingDomainEvents).toHaveLength(0);
      const retry = UserEntity.create();
      await uow.execute(async ({ users }) => users.save(retry));
      expect(
        await db.selectFrom("messaging_outbox").selectAll().execute(),
      ).toHaveLength(1);
    });
  },
);
