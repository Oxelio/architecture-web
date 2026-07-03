// src/composition-root/identity.container.ts

import { Redis } from "ioredis";
import {
  SignInUseCase,
  GetUserProfileUseCase,
  SignOutUseCase,
  SignUpUseCase,
  ResolveSessionUseCase,
} from "@architecture/identity/application";
import { RedisSessionAdapter } from "@architecture/identity-session-redis";
import { KyselyUserAdapter } from "@architecture/identity-persistence-kysely";
import { Argon2PasswordHasherAdapter } from "@architecture/identity-password-argon2";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";

export interface IdentityContainer {
  readonly signUp: SignUpUseCase;
  readonly signIn: SignInUseCase;
  readonly signOut: SignOutUseCase;
  readonly getUserProfile: GetUserProfileUseCase;
}

export function buildIdentityContainer(db: Kysely<AppDatabase>, redis: Redis) {
  // infrastructure
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const user = new KyselyUserAdapter(db);
  const session = new RedisSessionAdapter(redis);

  // application
  const signUp = new SignUpUseCase(user, passwordHasher);
  const signIn = new SignInUseCase(user, passwordHasher, session);
  const signOut = new SignOutUseCase(session);
  const resolveSession = new ResolveSessionUseCase(session, user);
  const getUserProfile = new GetUserProfileUseCase(user);

  return {
    signUp,
    signIn,
    signOut,
    resolveSession,
    getUserProfile,
  };
}
