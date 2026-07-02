// src/composition-root/identity.container.ts

import { Redis } from "ioredis";
import {
  AuthenticateUserUseCase,
  LogoutUserUseCase,
  RegisterUserUseCase,
  ValidateSessionUseCase,
} from "@architecture/identity/application";
import { RedisSessionAdapter } from "@architecture/identity/infrastructure";
import { KyselyUserAdapter } from "@architecture/identity-persistence-kysely";
import { Argon2PasswordHasherAdapter } from "@architecture/identity-password-argon2";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";

export function buildIdentityContainer(db: Kysely<AppDatabase>, redis: Redis) {
  // infrastructure
  const passwordHasher = new Argon2PasswordHasherAdapter();
  const userRepository = new KyselyUserAdapter(db);
  const session = new RedisSessionAdapter(redis);

  // application
  const registerUser = new RegisterUserUseCase(userRepository, passwordHasher);
  const authenticateUser = new AuthenticateUserUseCase(
    userRepository,
    passwordHasher,
    session,
  );
  const validateSession = new ValidateSessionUseCase(session, userRepository);
  const logoutUser = new LogoutUserUseCase(session);

  return {
    registerUser,
    authenticateUser,
    validateSession,
    logoutUser,
  };
}
