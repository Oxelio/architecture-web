// src/composition-root/identity.container.ts

import { Redis } from "ioredis";
import {
  AuthenticateUserUseCase,
  LogoutUserUseCase,
  RegisterUserUseCase,
  ValidateSessionUseCase,
} from "@architecture/identity/application";
import {
  PasswordHasherArgon2,
  KyselyUserRepository,
  RedisSessionAdapter,
} from "@architecture/identity/infrastructure";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";

export function buildIdentityContainer(db: Kysely<AppDatabase>, redis: Redis) {
  // infrastructure
  const passwordHasher = new PasswordHasherArgon2();
  const userRepository = new KyselyUserRepository(db);
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
