import { randomUUID } from "node:crypto";

import {
  AuditApplication,
  AuditIntegrationEventHandler,
} from "@architecture/audit/application";
import { KyselyAuditRepositoryAdapter } from "@architecture/audit-persistence-kysely";
import { UserEntity } from "@architecture/iam/domain";
import { KyselyIamUnitOfWorkAdapter } from "@architecture/iam-persistence-kysely";
import { IntegrationEventRouter } from "@architecture/messaging/application";
import type { IntegrationEvent } from "@architecture/messaging/domain";
import {
  KyselyOutboxRepositoryAdapter,
  KyselyOutboxWriterAdapter,
} from "@architecture/messaging-persistence-kysely";
import {
  MarkNotificationReadUseCase,
  NotificationEventHandlerUseCase,
} from "@architecture/notifications/application";
import {
  NotificationEntity,
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import { KyselyNotificationRepositoryAdapter } from "@architecture/notifications-persistence-kysely";
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
      await db.deleteFrom("messaging_outbox").execute();
      await db.deleteFrom("audit_events").execute();
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
            { channel: "email", destination: "user@example.test" },
            { channel: "sms", destination: "test-destination" },
          ],
        });
      await Promise.all([
        notifications.create(make()),
        notifications.create(make()),
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

    it("dead-letters ten abandoned outbox attempts", async () => {
      const fact = event();
      await writer.append([fact]);
      for (let attempt = 1; attempt <= 10; attempt++) {
        const claim = await outbox.claim();
        expect(claim?.message.attempts).toBe(attempt);
        await expireOutbox(fact.eventId);
        await outbox.recoverStale();
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
          notifications.claimDelivery(),
          notifications.claimDelivery(),
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
        await notifications.create(make());
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
      },
    );

    it.each([true, false])(
      "fences stale delivery finalization (new success=%s)",
      async (success) => {
        await notification();
        const old = await notifications.claimDelivery();
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
        const current = await notifications.claimDelivery();
        if (!current) {
          throw new Error("Missing replacement");
        }
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

    it("dead-letters ten abandoned deliveries", async () => {
      await notification();
      const initial = await notifications.claimDelivery();
      if (!initial) {
        throw new Error("Missing delivery");
      }
      await db
        .deleteFrom("notification_deliveries")
        .where("id", "!=", initial.delivery.identifier.value)
        .execute();
      for (let attempt = 1; attempt <= 10; attempt++) {
        const claim =
          attempt === 1 ? initial : await notifications.claimDelivery();
        expect(claim?.delivery.attempts).toBe(attempt);
        await expireDeliveries();
        await notifications.recoverStaleDeliveries();
        await db
          .updateTable("notification_deliveries")
          .set({ available_at: new Date(0) })
          .execute();
      }
      expect(await notifications.claimDelivery()).toBeNull();
      expect(
        (
          await db
            .selectFrom("notification_deliveries")
            .selectAll()
            .executeTakeFirstOrThrow()
        ).status,
      ).toBe("dead_letter");
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
        new AuditApplication(new KyselyAuditRepositoryAdapter(db as never)),
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
        },
        [],
      );
      const router = new IntegrationEventRouter([audit, handler]);
      vi.spyOn(notifications, "create").mockRejectedValueOnce(
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
