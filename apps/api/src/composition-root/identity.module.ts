// @file apps/api/src/composition-root/identity.module.ts

import {
  createIdentity,
  type IdentityApplication,
  type IdentityDependencies,
} from "@architecture/identity/application";
import { NodemailerEmailSenderAdapter } from "@architecture/identity-email-nodemailer";
import { Argon2PasswordHasherAdapter } from "@architecture/identity-password-argon2";
import {
  KyselyEmailVerificationAdapter,
  KyselyUserAdapter,
} from "@architecture/identity-persistence-kysely";
import {
  RedisEmailVerificationRateLimitAdapter,
  RedisSessionAdapter,
} from "@architecture/identity-session-redis";
import { Redis } from "ioredis";
import type { Kysely } from "kysely";

import type { AppConfig } from "#config/app.config";

import type { AppDatabase } from "./database.module.js";

function buildIdentityDependencies(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig["smtp"],
): IdentityDependencies {
  return {
    passwordHasher: new Argon2PasswordHasherAdapter(),

    userRepository: new KyselyUserAdapter(db),

    emailVerificationRepository: new KyselyEmailVerificationAdapter(db),

    sessionRepository: new RedisSessionAdapter(redis),

    rateLimiter: new RedisEmailVerificationRateLimitAdapter(redis),

    emailSender: new NodemailerEmailSenderAdapter(
      config.host,
      config.port,
      config.username,
      config.password,
      config.from,
      config.verifyUrl,
    ),
  };
}

export function buildIdentityModule(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig["smtp"],
): IdentityApplication {
  const dependencies = buildIdentityDependencies(db, redis, config);

  return createIdentity(dependencies);
}
