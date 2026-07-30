// @file apps/api/src/composition-root/application.module.ts

import {
  AuditApplication,
  AuditIntegrationEventHandler,
  KyselyAuditRepository,
} from "@architecture/audit";
import type { IamApplication } from "@architecture/iam/application";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import { RedisSessionAdapter } from "@architecture/iam-session-redis";
import {
  IntegrationEventRouter,
  KyselyOutboxStore,
  KyselyOutboxWriter,
  OutboxWorker,
} from "@architecture/messaging";
import {
  KyselyNotificationRepository,
  NotificationApplication,
  type NotificationDelivery,
} from "@architecture/notifications";

import {
  KyselyNotificationRecipientDirectory,
  SlackWebhookNotificationAdapter,
  SmsWebhookNotificationAdapter,
} from "#adapters/notification.adapters";
import { SecurityService } from "#app/security/security.service";
import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIamModule } from "./iam.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly iam: IamApplication;
  readonly security: SecurityService;
  readonly audit: AuditApplication;
  readonly notifications: NotificationApplication;
  readonly outboxWorker: OutboxWorker;

  dispose(): Promise<void>;
}

export function buildApplicationModule(): ApplicationModule {
  const config = loadConfig();

  const db = createDatabase(config.database);
  const redis = createRedis(config.redis);
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const sessions = new RedisSessionAdapter(redis);
  const email = new NodemailerEmailSenderAdapter(
    config.smtp.host,
    config.smtp.port,
    config.smtp.username,
    config.smtp.password,
    config.smtp.from,
    config.smtp.verifyUrl,
  );
  const audit = new AuditApplication(new KyselyAuditRepository(db as never));
  const deliveries: NotificationDelivery[] = [email];
  if (config.notifications.slackWebhookUrl) {
    deliveries.push(
      new SlackWebhookNotificationAdapter(config.notifications.slackWebhookUrl),
    );
  }
  if (config.notifications.smsWebhookUrl) {
    deliveries.push(
      new SmsWebhookNotificationAdapter(config.notifications.smsWebhookUrl),
    );
  }
  const notifications = new NotificationApplication(
    new KyselyNotificationRepository(db as never),
    new KyselyNotificationRecipientDirectory(db),
    deliveries,
  );
  const router = new IntegrationEventRouter([
    new AuditIntegrationEventHandler(audit),
    notifications,
  ]);
  const outboxWorker = new OutboxWorker(
    new KyselyOutboxStore(db as never),
    router,
  );
  outboxWorker.start();
  const notificationTimer = setInterval(() => {
    void notifications.deliverPending().catch((error: unknown) => {
      console.error("Notification delivery polling failed", error);
    });
  }, 1_000);
  notificationTimer.unref();
  const outbox = new KyselyOutboxWriter(db as never);
  const security = new SecurityService({
    db,
    passwordHasher,
    sessions,
    email,
    encryptionKey: config.security.encryptionKey,
    recoveryUrl: config.smtp.recoveryUrl,
    deletionCancellationUrl: config.smtp.deletionCancellationUrl,
    audit,
    outbox,
  });

  return {
    iam: buildIamModule(db, redis, security, email, outbox),
    security,
    audit,
    notifications,
    outboxWorker,

    async dispose() {
      outboxWorker.stop();
      clearInterval(notificationTimer);
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
