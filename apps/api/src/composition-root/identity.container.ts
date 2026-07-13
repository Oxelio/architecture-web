// @file apps/api/src/composition-root/identity.container.ts

// apps/api/src/composition-root/identity.container.ts

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

import type { AppConfig } from "../config/app.config.js";
import type { AppDatabase } from "./database.container.js";

export interface IdentityContainer {
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

export function buildIdentityContainer(
  db: Kysely<AppDatabase>,
  redis: Redis,
  config: AppConfig,
) {
  // infrastructure
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const user = new KyselyUserAdapter(db);
  const emailVerification = new KyselyEmailVerificationAdapter(db);
  const emailSender = new NodemailerEmailSenderAdapter(
    config.smtp.host,
    config.smtp.port,
    config.smtp.username,
    config.smtp.password,
    config.smtp.from,
    config.smtp.verifyUrl,
  );
  const session = new RedisSessionAdapter(redis);
  const rateLimit = new RedisEmailVerificationRateLimitAdapter(redis);

  // application
  const signUp = new SignUpUseCase(
    user,
    passwordHasher,
    emailVerification,
    emailSender,
  );
  const signIn = new SignInUseCase(user, passwordHasher, session);
  const signOut = new SignOutUseCase(session);
  const resolveSession = new ResolveSessionUseCase(session, user);
  const getUserProfile = new GetUserProfileUseCase(user);
  const verifyEmail = new VerifyEmailUseCase(user, emailVerification);
  const resendEmailVerification = new ResendEmailVerificationUseCase(
    user,
    emailVerification,
    emailSender,
    rateLimit,
  );
  const changeEmail = new ChangeEmailUseCase(user);
  const changePassword = new ChangePasswordUseCase(user, passwordHasher);
  const activateUser = new ActivateUserUseCase(user);
  const suspendUser = new SuspendUserUseCase(user);

  return {
    signUp,
    signIn,
    signOut,
    resolveSession,
    getUserProfile,
    verifyEmail,
    resendEmailVerification,
    changeEmail,
    changePassword,
    activateUser,
    suspendUser,
  };
}
