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
import type { OutboxWriter } from "@architecture/messaging/application";
import { KyselyOutboxWriterAdapter } from "@architecture/messaging-persistence-kysely";
import { Redis } from "ioredis";
import type { Kysely } from "kysely";

import {
  HeuristicPasswordStrengthEvaluator,
  LocalCommonPasswordChecker,
  LocalCompromisedPasswordChecker,
} from "#adapters/local-password-security.adapter";

import type { AppDatabase } from "./database.module.js";

function buildIamDependencies(
  db: Kysely<AppDatabase>,
  redis: Redis,
  policyProvider: IamDependencies["policyProvider"],
  emailSender: NodemailerEmailSenderAdapter,
  outbox: OutboxWriter,
): IamDependencies {
  return {
    passwordHasher: new Argon2PasswordHasherAdapter(),
    policyProvider,
    passwordStrengthEvaluator: new HeuristicPasswordStrengthEvaluator(),
    commonPasswordChecker: new LocalCommonPasswordChecker(),
    compromisedPasswordChecker: new LocalCompromisedPasswordChecker(),
    emailVerificationTokenHasher:
      new Sha256EmailVerificationTokenHasherAdapter(),

    userRepository: new KyselyUserAdapter(db as never),

    emailVerificationRepository: new KyselyEmailVerificationAdapter(
      db as never,
    ),

    unitOfWork: new KyselyIamUnitOfWorkAdapter(
      db as never,
      (transaction) => new KyselyOutboxWriterAdapter(transaction as never),
    ),
    outbox,

    sessionRepository: new RedisSessionAdapter(redis),

    rateLimiter: new RedisEmailVerificationRateLimitAdapter(redis),

    emailSender,
  };
}

export function buildIamModule(
  db: Kysely<AppDatabase>,
  redis: Redis,
  security: SecondFactorGate & IamPolicyProvider,
  emailSender: NodemailerEmailSenderAdapter,
  outbox: OutboxWriter,
): IamApplication {
  const dependencies = buildIamDependencies(
    db,
    redis,
    security,
    emailSender,
    outbox,
  );

  return createIam({
    ...dependencies,
    secondFactorGate: security,
  });
}
