import type { AuditApplication } from "@architecture/audit/application";
import {
  type ConfigurationStore,
  createIam,
  createIamSecurity,
  type IamApplication,
  type IamSecurityApplication,
  PasswordValidation,
  PublishedIamPolicies,
  type SecurityEventRecorder,
} from "@architecture/iam/application";
import type { NodemailerEmailSenderAdapter } from "@architecture/iam-email-nodemailer";
import { Sha256EmailVerificationTokenHasherAdapter } from "@architecture/iam-email-verification-sha256";
import { Argon2PasswordHasherAdapter } from "@architecture/iam-password-argon2";
import {
  type IamDatabase,
  KyselyAccountDeletionAdapter,
  KyselyAccountExportAdapter,
  KyselyEmailVerificationAdapter,
  KyselyIamUnitOfWorkAdapter,
  KyselyLoginIdentityAdapter,
  KyselyMfaAdapter,
  KyselyPasswordAuthenticatorAdapter,
  KyselyPasswordRecoveryAdapter,
  KyselySecurityConfigurationAdapter,
  KyselyUserAdapter,
} from "@architecture/iam-persistence-kysely";
import {
  RedisEmailVerificationRateLimitAdapter,
  RedisSessionAdapter,
} from "@architecture/iam-session-redis";
import type { OutboxWriter } from "@architecture/messaging/application";
import { KyselyOutboxWriterAdapter } from "@architecture/messaging-persistence-kysely";
import type { Redis } from "ioredis";
import type { Kysely } from "kysely";

import { AccountSecurityMailAdapter } from "#adapters/iam/account-security-mail.adapter";
import { AuditSecurityEventsAdapter } from "#adapters/iam/audit-security-events.adapter";
import { NodeAccountArchiveAdapter } from "#adapters/iam/node-account-archive.adapter";
import { NodeMfaCryptographyAdapter } from "#adapters/iam/node-mfa-cryptography.adapter";
import { NodeSecurityTokensAdapter } from "#adapters/iam/node-security-tokens.adapter";
import {
  HeuristicPasswordStrengthEvaluator,
  LocalCommonPasswordChecker,
  LocalCompromisedPasswordChecker,
} from "#adapters/local-password-security.adapter";

import type { AppDatabase } from "./database.module.js";
export async function buildIamModule(
  database: Kysely<AppDatabase>,
  redis: Redis,
  email: NodemailerEmailSenderAdapter,
  outbox: OutboxWriter,
  audit: AuditApplication,
  options: {
    encryptionKey: string;
    recoveryUrl: string;
    deletionCancellationUrl: string;
  },
): Promise<{
  iam: IamApplication;
  security: IamSecurityApplication;
  configuration: ConfigurationStore;
  securityEvents: SecurityEventRecorder;
}> {
  const db = database as unknown as Kysely<IamDatabase>;
  const createOutbox = (transaction: Kysely<IamDatabase>) =>
    new KyselyOutboxWriterAdapter(transaction as never);
  const configuration = new KyselySecurityConfigurationAdapter(
    db,
    createOutbox,
  );
  await configuration.initialize();
  const policies = new PublishedIamPolicies(configuration),
    events = new AuditSecurityEventsAdapter(audit, configuration);
  const users = new KyselyUserAdapter(db, outbox),
    identities = new KyselyLoginIdentityAdapter(db, outbox),
    passwords = new KyselyPasswordAuthenticatorAdapter(db, outbox),
    sessions = new RedisSessionAdapter(redis),
    hasher = new Argon2PasswordHasherAdapter();
  const strength = new HeuristicPasswordStrengthEvaluator(),
    common = new LocalCommonPasswordChecker(),
    compromised = new LocalCompromisedPasswordChecker();
  const security = createIamSecurity({
    users,
    identities,
    passwords,
    sessions,
    hasher,
    policies,
    configuration,
    recovery: new KyselyPasswordRecoveryAdapter(db, createOutbox),
    mfa: new KyselyMfaAdapter(db, createOutbox),
    exports: new KyselyAccountExportAdapter(db, createOutbox),
    deletions: new KyselyAccountDeletionAdapter(db, createOutbox),
    validation: new PasswordValidation(strength, common, compromised),
    crypto: new NodeMfaCryptographyAdapter(options.encryptionKey),
    tokens: new NodeSecurityTokensAdapter(),
    mail: new AccountSecurityMailAdapter(
      email,
      options.recoveryUrl,
      options.deletionCancellationUrl,
    ),
    events,
    origins: events,
    audit: events,
    archive: new NodeAccountArchiveAdapter(),
    outbox,
  });
  const iam = createIam({
    userRepository: users,
    userQueryRepository: users,
    loginIdentityRepository: identities,
    passwordAuthenticatorRepository: passwords,
    sessionRepository: sessions,
    passwordHasher: hasher,
    accountPolicies: policies,
    sessionPolicies: policies,
    passwordPolicyReader: policies,
    passwordStrengthEvaluator: strength,
    commonPasswordChecker: common,
    compromisedPasswordChecker: compromised,
    emailSender: email,
    emailVerificationRepository: new KyselyEmailVerificationAdapter(db),
    rateLimiter: new RedisEmailVerificationRateLimitAdapter(redis),
    emailVerificationTokenHasher:
      new Sha256EmailVerificationTokenHasherAdapter(),
    unitOfWork: new KyselyIamUnitOfWorkAdapter(db, createOutbox),
    outbox,
    beginSecondFactor: security.beginSecondFactor,
  });
  return { iam, security, configuration, securityEvents: events };
}
