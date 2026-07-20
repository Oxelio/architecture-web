// @file apps/api/src/composition-root/identity.module.ts

import type {
  EmailSenderPort,
  EmailVerificationPort,
  EmailVerificationRateLimitPort,
  PasswordHasherPort,
  SessionPort,
  UserPort,
} from "@architecture/identity/application";
import {
  ActivateUserUseCase,
  ChangeEmailUseCase,
  ChangePasswordUseCase,
  GetUserProfileUseCase,
  ResendEmailVerificationUseCase,
  ResolveSessionUseCase,
  SignInUseCase,
  SignOutUseCase,
  SignUpUseCase,
  SuspendUserUseCase,
  VerifyEmailUseCase,
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

export interface IdentityModule {
  readonly signUp: SignUpUseCase;
  readonly signIn: SignInUseCase;
  readonly signOut: SignOutUseCase;
  readonly resolveSession: ResolveSessionUseCase;
  readonly getUserProfile: GetUserProfileUseCase;
  readonly verifyEmail: VerifyEmailUseCase;
  readonly resendEmailVerification: ResendEmailVerificationUseCase;
  readonly changeEmail: ChangeEmailUseCase;
  readonly changePassword: ChangePasswordUseCase;
  readonly activateUser: ActivateUserUseCase;
  readonly suspendUser: SuspendUserUseCase;
}

interface IdentityDependencies {
  passwordHasher: PasswordHasherPort;
  user: UserPort;
  session: SessionPort;
  emailVerification: EmailVerificationPort;
  emailSender: EmailSenderPort;
  rateLimit: EmailVerificationRateLimitPort;
}

function buildIdentityDependencies(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig["smtp"],
): IdentityDependencies {
  return {
    passwordHasher: new Argon2PasswordHasherAdapter(),

    user: new KyselyUserAdapter(db),

    emailVerification: new KyselyEmailVerificationAdapter(db),

    session: new RedisSessionAdapter(redis),

    rateLimit: new RedisEmailVerificationRateLimitAdapter(redis),

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

function buildIdentityApplication(
  dependencies: IdentityDependencies,
): IdentityModule {
  return {
    signUp: new SignUpUseCase(
      dependencies.user,
      dependencies.passwordHasher,
      dependencies.emailVerification,
      dependencies.emailSender,
    ),

    signIn: new SignInUseCase(
      dependencies.user,
      dependencies.passwordHasher,
      dependencies.session,
    ),

    signOut: new SignOutUseCase(dependencies.session),

    resolveSession: new ResolveSessionUseCase(
      dependencies.session,
      dependencies.user,
    ),

    getUserProfile: new GetUserProfileUseCase(dependencies.user),

    verifyEmail: new VerifyEmailUseCase(
      dependencies.user,
      dependencies.emailVerification,
    ),

    resendEmailVerification: new ResendEmailVerificationUseCase(
      dependencies.user,
      dependencies.emailVerification,
      dependencies.emailSender,
      dependencies.rateLimit,
    ),

    changeEmail: new ChangeEmailUseCase(dependencies.user),

    changePassword: new ChangePasswordUseCase(
      dependencies.user,
      dependencies.passwordHasher,
    ),

    activateUser: new ActivateUserUseCase(dependencies.user),

    suspendUser: new SuspendUserUseCase(dependencies.user),
  };
}

export function buildIdentityModule(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig["smtp"],
): IdentityModule {
  const dependencies = buildIdentityDependencies(db, redis, config);

  return buildIdentityApplication(dependencies);
}
