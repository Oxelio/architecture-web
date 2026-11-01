// @file apps/api/src/composition-root/application.module.ts

import {
  AcceptAuditEntryUseCase,
  AuditAcceptanceEventHandler,
  AuditApplication,
  AuditIntegrationEventHandler,
  type AuditQueriesApplication,
  createAuditQueries,
} from "@architecture/audit/application";
import {
  type AuditDatabase,
  KyselyAuditRepositoryAdapter,
} from "@architecture/audit-persistence-kysely";
import type {
  IamApplication,
  PublishedConfigurationReader,
  SecurityEventRecorder,
} from "@architecture/iam/application";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import {
  type IamDatabase,
  KyselyUserAdapter,
} from "@architecture/iam-persistence-kysely";
import {
  IntegrationEventRouter,
  OutboxWorker,
} from "@architecture/messaging/application";
import {
  KyselyOutboxRepositoryAdapter,
  KyselyOutboxWriterAdapter,
  type MessagingDatabase,
} from "@architecture/messaging-persistence-kysely";
import {
  createNotifications,
  type NotificationDelivery,
  type NotificationsApplication,
} from "@architecture/notifications/application";
import { NodemailerNotificationDeliveryAdapter } from "@architecture/notifications-delivery-nodemailer";
import { SlackWebhookNotificationDeliveryAdapter } from "@architecture/notifications-delivery-slack-webhook";
import { SmsWebhookNotificationDeliveryAdapter } from "@architecture/notifications-delivery-sms-webhook";
import {
  KyselyNotificationPreferenceRepositoryAdapter,
  KyselyNotificationRepositoryAdapter,
  type NotificationDatabase,
} from "@architecture/notifications-persistence-kysely";
import { KyselyIamNotificationRecipientDirectoryAdapter } from "@architecture/notifications-recipient-iam-kysely";

import { IamAuditAccessAdapter } from "#adapters/audit/iam-audit-access.adapter";
import { Sha256AuditPseudonymizerAdapter } from "#adapters/audit/sha256-audit-pseudonymizer.adapter";
import { loadConfig } from "#config/app.config";

import { startBackgroundPolling } from "./background-polling.js";
import { createDatabase } from "./database.module.js";
import { buildIamModule } from "./iam.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly iam: IamApplication;
  readonly securityEvents: SecurityEventRecorder;
  readonly configuration: PublishedConfigurationReader;
  readonly audit: AuditApplication;
  readonly auditQueries: AuditQueriesApplication;
  readonly notifications: NotificationsApplication;
  readonly outboxWorker: OutboxWorker;

  dispose(): Promise<void>;
}

export async function buildApplicationModule(): Promise<ApplicationModule> {
  const config = loadConfig();

  const db = createDatabase(config.database);
  let disconnectRedis: (() => void) | undefined;
  try {
    const redis = createRedis(config.redis);
    disconnectRedis = () => redis.disconnect();
    const email = new NodemailerEmailSenderAdapter(
      config.smtp.host,
      config.smtp.port,
      config.smtp.username,
      config.smtp.password,
      config.smtp.from,
      config.smtp.verifyUrl,
    );
    const messagingDb = db.$pickTables<keyof MessagingDatabase>();
    const auditDb = db.$pickTables<keyof AuditDatabase>();
    const notificationDb = db.$pickTables<keyof NotificationDatabase>();
    const iamDb = db.$pickTables<keyof IamDatabase>();
    const outbox = new KyselyOutboxWriterAdapter(messagingDb);
    const pseudonymizer = new Sha256AuditPseudonymizerAdapter();
    const acceptance = new AcceptAuditEntryUseCase(outbox, pseudonymizer);
    const auditRepository = new KyselyAuditRepositoryAdapter(auditDb);
    const audit = new AuditApplication(auditRepository, pseudonymizer);
    const deliveries: NotificationDelivery[] = [
      new NodemailerNotificationDeliveryAdapter(
        config.smtp.host,
        config.smtp.port,
        config.smtp.username,
        config.smtp.password,
        config.smtp.from,
      ),
    ];
    if (config.notifications.slackWebhookUrl) {
      deliveries.push(
        new SlackWebhookNotificationDeliveryAdapter(
          config.notifications.slackWebhookUrl,
        ),
      );
    }
    if (config.notifications.smsWebhookUrl) {
      deliveries.push(
        new SmsWebhookNotificationDeliveryAdapter(
          config.notifications.smsWebhookUrl,
        ),
      );
    }
    const notifications = createNotifications({
      notificationRepository: new KyselyNotificationRepositoryAdapter(
        notificationDb,
      ),
      preferenceRepository: new KyselyNotificationPreferenceRepositoryAdapter(
        notificationDb,
      ),
      recipientDirectory: new KyselyIamNotificationRecipientDirectoryAdapter(
        iamDb,
      ),
      deliveries,
    });
    const iamModule = await buildIamModule(
      db,
      redis,
      email,
      outbox,
      audit,
      acceptance,
      {
        encryptionKey: config.security.encryptionKey,
        recoveryUrl: config.smtp.recoveryUrl,
        deletionCancellationUrl: config.smtp.deletionCancellationUrl,
      },
    );
    const router = new IntegrationEventRouter([
      new AuditAcceptanceEventHandler(audit),
      new AuditIntegrationEventHandler(audit, {
        getRetentionDays: async () =>
          (await iamModule.configuration.readPublished()).values.audit
            .retentionDays,
      }),
      notifications.integrationEventHandler,
    ]);
    const auditQueries = createAuditQueries({
      repository: auditRepository,
      recorder: acceptance,
      access: new IamAuditAccessAdapter(
        new KyselyUserAdapter(iamDb),
        iamModule.configuration,
      ),
    });
    const outboxWorker = new OutboxWorker(
      new KyselyOutboxRepositoryAdapter(messagingDb),
      router,
    );
    const stopOutbox = startBackgroundPolling(
      () => outboxWorker.drain(),
      (error) => {
        console.error("Outbox polling failed", error);
      },
    );
    const stopNotifications = startBackgroundPolling(
      () => notifications.deliverPending.execute(),
      (error) => {
        console.error("Notification delivery polling failed", error);
      },
    );
    const stopAudit = startBackgroundPolling(
      () => audit.purge(),
      (error) => {
        console.error("Audit retention polling failed", error);
      },
      3_600_000,
    );

    return {
      ...iamModule,
      audit,
      auditQueries,
      notifications,
      outboxWorker,

      async dispose() {
        const stopped = await Promise.allSettled([
          stopOutbox(),
          stopNotifications(),
          stopAudit(),
        ]);
        const closed = await Promise.allSettled([redis.quit(), db.destroy()]);
        const failures = [...stopped, ...closed]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason as unknown);
        if (failures.length) {
          throw new AggregateError(
            failures,
            "Application resource cleanup failed",
          );
        }
      },
    };
  } catch (error) {
    disconnectRedis?.();
    try {
      await db.destroy();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Application initialization and cleanup failed",
      );
    }
    throw error;
  }
}
