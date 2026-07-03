// src/composition-root/identity.container.ts

import { Redis } from "ioredis";
import {
  AuthenticateUserUseCase,
  GetCurrentUserProfileUseCase,
  LogoutUserUseCase,
  RegisterUserUseCase,
  ValidateSessionUseCase,
} from "@architecture/identity/application";
import { RedisSessionAdapter } from "@architecture/identity-session-redis";
import { KyselyUserAdapter } from "@architecture/identity-persistence-kysely";
import { Argon2PasswordHasherAdapter } from "@architecture/identity-password-argon2";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";

export interface IdentityContainer {
  readonly registerUser: RegisterUserUseCase;
  readonly authenticateUser: AuthenticateUserUseCase;
  readonly logoutUser: LogoutUserUseCase;
  readonly getCurrentUserProfile: GetCurrentUserProfileUseCase;
}

export function buildIdentityContainer(db: Kysely<AppDatabase>, redis: Redis) {
  // infrastructure
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const user = new KyselyUserAdapter(db);
  const session = new RedisSessionAdapter(redis);

  // application
  const registerUser = new RegisterUserUseCase(user, passwordHasher);
  const authenticateUser = new AuthenticateUserUseCase(
    user,
    passwordHasher,
    session,
  );
  const validateSession = new ValidateSessionUseCase(session, user);
  const logoutUser = new LogoutUserUseCase(session);
  const getCurrentUserProfile = new GetCurrentUserProfileUseCase(user);

  return {
    registerUser,
    authenticateUser,
    validateSession,
    logoutUser,
    getCurrentUserProfile,
  };
}
