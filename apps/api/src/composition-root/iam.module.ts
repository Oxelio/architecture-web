// @file apps/api/src/composition-root/iam.module.ts

import {
  createIam,
  type IamApplication,
  type IamDependencies,
  type SecondFactorGate,
} from "@architecture/iam/application";
import { createPasswordPolicy } from "@architecture/iam/domain";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Sha256EmailVerificationTokenHasherAdapter } from "@architecture/iam-email-verification-sha256";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import {
  KyselyEmailVerificationAdapter,
  KyselyUserAdapter,
} from "@architecture/iam-persistence-kysely";
import {
  RedisEmailVerificationRateLimitAdapter,
  RedisSessionAdapter,
} from "@architecture/iam-session-redis";
import { Redis } from "ioredis";
import type { Kysely } from "kysely";

import {
  HeuristicPasswordStrengthEvaluator,
  LocalCommonPasswordChecker,
  LocalCompromisedPasswordChecker,
} from "#adapters/local-password-security.adapter";
import type { AppConfig } from "#config/app.config";

import type { AppDatabase } from "./database.module.js";

function buildIamDependencies(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig,
): IamDependencies {
  const passwordPolicy = createPasswordPolicy(config.passwordPolicy.level, {
    ...(config.passwordPolicy.minLength === undefined
      ? {}
      : { minLength: config.passwordPolicy.minLength }),
    maxLength: config.passwordPolicy.maxLength,
    ...(config.passwordPolicy.minimumStrength === undefined
      ? {}
      : { minimumStrength: config.passwordPolicy.minimumStrength }),
    checkCommonPasswords: config.passwordPolicy.checkCommonPasswords,
    checkCompromisedPasswords: config.passwordPolicy.checkCompromisedPasswords,
    checkUserContext: config.passwordPolicy.checkUserContext,
    rejectCurrentPassword: config.passwordPolicy.rejectCurrentPassword,
    composition: {
      requireUppercase: config.passwordPolicy.requireUppercase,
      requireLowercase: config.passwordPolicy.requireLowercase,
      requireNumber: config.passwordPolicy.requireNumber,
      requireSpecialCharacter: config.passwordPolicy.requireSpecialCharacter,
    },
  });
  const privilegedPasswordPolicy = createPasswordPolicy(
    config.passwordPolicy.privilegedLevel,
    {
      maxLength: config.passwordPolicy.maxLength,
      checkCommonPasswords: config.passwordPolicy.checkCommonPasswords,
      checkCompromisedPasswords:
        config.passwordPolicy.checkCompromisedPasswords,
      checkUserContext: config.passwordPolicy.checkUserContext,
      rejectCurrentPassword: config.passwordPolicy.rejectCurrentPassword,
      composition: {
        requireUppercase: config.passwordPolicy.requireUppercase,
        requireLowercase: config.passwordPolicy.requireLowercase,
        requireNumber: config.passwordPolicy.requireNumber,
        requireSpecialCharacter: config.passwordPolicy.requireSpecialCharacter,
      },
    },
  );

  return {
    passwordHasher: new Argon2PasswordHasherAdapter(),
    passwordPolicy,
    privilegedPasswordPolicy,
    passwordStrengthEvaluator: new HeuristicPasswordStrengthEvaluator(),
    commonPasswordChecker: new LocalCommonPasswordChecker(),
    compromisedPasswordChecker: new LocalCompromisedPasswordChecker(),
    emailVerificationTokenHasher:
      new Sha256EmailVerificationTokenHasherAdapter(),

    userRepository: new KyselyUserAdapter(db),

    emailVerificationRepository: new KyselyEmailVerificationAdapter(db),

    sessionRepository: new RedisSessionAdapter(redis),

    rateLimiter: new RedisEmailVerificationRateLimitAdapter(redis),

    emailSender: new NodemailerEmailSenderAdapter(
      config.smtp.host,
      config.smtp.port,
      config.smtp.username,
      config.smtp.password,
      config.smtp.from,
      config.smtp.verifyUrl,
    ),
  };
}

export function buildIamModule(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig,
  secondFactorGate?: SecondFactorGate,
): IamApplication {
  const dependencies = buildIamDependencies(db, redis, config);

  return createIam({
    ...dependencies,
    ...(secondFactorGate ? { secondFactorGate } : {}),
  });
}
