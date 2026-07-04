// src/composition-root/identity.container.ts

import { Redis } from "ioredis";
import {
  SignInUseCase,
  GetUserProfileUseCase,
  SignOutUseCase,
  SignUpUseCase,
  VerifyEmailUseCase,
  ResolveSessionUseCase,
} from "@architecture/identity/application";
import { RedisSessionAdapter } from "@architecture/identity-session-redis";
import {
  KyselyUserAdapter,
  KyselyEmailVerificationAdapter,
} from "@architecture/identity-persistence-kysely";
import { Argon2PasswordHasherAdapter } from "@architecture/identity-password-argon2";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";
import { NodemailerEmailSenderAdapter } from "@architecture/identity-email-nodemailer";

export interface IdentityContainer {
  readonly signUp: SignUpUseCase;
  readonly signIn: SignInUseCase;
  readonly signOut: SignOutUseCase;
  readonly resolveSession: ResolveSessionUseCase;
  readonly getUserProfile: GetUserProfileUseCase;
  readonly verifyEmail: VerifyEmailUseCase;
}

export function buildIdentityContainer(db: Kysely<AppDatabase>, redis: Redis) {
  // infrastructure
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const user = new KyselyUserAdapter(db);
  const emailVerification = new KyselyEmailVerificationAdapter(db);
  const emailSender = new NodemailerEmailSenderAdapter(
    process.env["SMTP_HOST"] ?? "localhost",
    Number(process.env["SMTP_PORT"] ?? 587),
    process.env["SMTP_USERNAME"] ?? "user",
    process.env["SMTP_PASSWORD"] ?? "user",
    process.env["SMTP_FROM_ADDRESS"] ?? "no-reply@example.com",
    process.env["APP_URL"] ?? "http://localhost:3000/v1/identity",
  );
  const session = new RedisSessionAdapter(redis);

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

  return {
    signUp,
    signIn,
    signOut,
    resolveSession,
    getUserProfile,
    verifyEmail,
  };
}
