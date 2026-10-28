// @file apps/api/src/composition-root/application.module.ts

import {
  AuditApplication,
  AuditIntegrationEventHandler,
} from "@architecture/audit/application";
import { KyselyAuditRepositoryAdapter } from "@architecture/audit-persistence-kysely";
import type {
  IamApplication,
  IamSecurityApplication,
  PublishedConfigurationReader,
  SecurityEventRecorder,
} from "@architecture/iam/application";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import {
  IntegrationEventRouter,
  OutboxWorker,
} from "@architecture/messaging/application";
import {
  KyselyOutboxRepositoryAdapter,
  KyselyOutboxWriterAdapter,
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
} from "@architecture/notifications-persistence-kysely";
import { KyselyIamNotificationRecipientDirectoryAdapter } from "@architecture/notifications-recipient-iam-kysely";

import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIamModule } from "./iam.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly iam: IamApplication;
  readonly security: IamSecurityApplication;
  readonly securityEvents: SecurityEventRecorder;
  readonly configuration: PublishedConfigurationReader;
  readonly audit: AuditApplication;
  readonly notifications: NotificationsApplication;
  readonly outboxWorker: OutboxWorker;

  dispose(): Promise<void>;
}

export async function buildApplicationModule(): Promise<ApplicationModule> {
  const config = loadConfig();

  const db = createDatabase(config.database);
  const redis = createRedis(config.redis);
  const email = new NodemailerEmailSenderAdapter(
    config.smtp.host,
    config.smtp.port,
    config.smtp.username,
    config.smtp.password,
    config.smtp.from,
    config.smtp.verifyUrl,
  );
  const audit = new AuditApplication(
    new KyselyAuditRepositoryAdapter(db as never),
  );
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
      db as never,
    ),
    preferenceRepository: new KyselyNotificationPreferenceRepositoryAdapter(
      db as never,
    ),
    recipientDirectory: new KyselyIamNotificationRecipientDirectoryAdapter(
      db as never,
    ),
    deliveries,
  });
  const outbox = new KyselyOutboxWriterAdapter(db as never);
  const iamModule = await buildIamModule(db, redis, email, outbox, audit, {
    encryptionKey: config.security.encryptionKey,
    recoveryUrl: config.smtp.recoveryUrl,
    deletionCancellationUrl: config.smtp.deletionCancellationUrl,
  });
  const router = new IntegrationEventRouter([
    new AuditIntegrationEventHandler(audit, {
      getRetentionDays: async () =>
        (await iamModule.configuration.readPublished()).values.audit
          .retentionDays,
    }),
    notifications.integrationEventHandler,
  ]);
  const outboxWorker = new OutboxWorker(
    new KyselyOutboxRepositoryAdapter(db as never),
    router,
  );
  const outboxTimer = setInterval(() => {
    void outboxWorker.drain().catch((error: unknown) => {
      console.error("Outbox polling failed", error);
    });
  }, 1_000);
  outboxTimer.unref();
  const notificationTimer = setInterval(() => {
    void notifications.deliverPending.execute().catch((error: unknown) => {
      console.error("Notification delivery polling failed", error);
    });
  }, 1_000);
  notificationTimer.unref();

  return {
    ...iamModule,
    audit,
    notifications,
    outboxWorker,

    async dispose() {
      clearInterval(outboxTimer);
      clearInterval(notificationTimer);
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
