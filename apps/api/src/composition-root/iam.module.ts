// @file apps/api/src/composition-root/iam.module.ts

import {
  createIam,
  type IamApplication,
  type IamDependencies,
  type IamPolicyProvider,
  type SecondFactorGate,
} from "@architecture/iam/application";
import { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Sha256EmailVerificationTokenHasherAdapter } from "@architecture/iam-email-verification-sha256";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import {
  KyselyEmailVerificationAdapter,
  KyselyIamUnitOfWorkAdapter,
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
  policyProvider: IamDependencies["policyProvider"],
): IamDependencies {
  return {
    passwordHasher: new Argon2PasswordHasherAdapter(),
    policyProvider,
    passwordStrengthEvaluator: new HeuristicPasswordStrengthEvaluator(),
    commonPasswordChecker: new LocalCommonPasswordChecker(),
    compromisedPasswordChecker: new LocalCompromisedPasswordChecker(),
    emailVerificationTokenHasher:
      new Sha256EmailVerificationTokenHasherAdapter(),

    userRepository: new KyselyUserAdapter(db),

    emailVerificationRepository: new KyselyEmailVerificationAdapter(db),

    unitOfWork: new KyselyIamUnitOfWorkAdapter(db),

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
  security: SecondFactorGate & IamPolicyProvider,
): IamApplication {
  const dependencies = buildIamDependencies(db, redis, config, security);

  return createIam({
    ...dependencies,
    secondFactorGate: security,
  });
}
