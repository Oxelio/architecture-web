// @file apps/api/src/composition-root/application.module.ts

import type { IamApplication } from "@architecture/iam/application";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import { RedisSessionAdapter } from "@architecture/iam-session-redis";

import { SecurityService } from "#app/security/security.service";
import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIamModule } from "./iam.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly iam: IamApplication;
  readonly security: SecurityService;

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
  const security = new SecurityService({
    db,
    passwordHasher,
    sessions,
    email,
    encryptionKey: config.security.encryptionKey,
    recoveryUrl: config.smtp.recoveryUrl,
    deletionCancellationUrl: config.smtp.deletionCancellationUrl,
  });

  return {
    iam: buildIamModule(db, redis, config, security),
    security,

    async dispose() {
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
