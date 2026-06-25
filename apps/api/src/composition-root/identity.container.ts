// src/composition-root/identity.container.ts

import { RegisterUserUseCase } from "@architecture/identity/application";
import {
  PasswordHasherArgon2,
  KyselyUserRepository,
} from "@architecture/identity/infrastructure";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";

export function buildIdentityContainer(db: Kysely<AppDatabase>) {
  // infrastructure
  const passwordHasher = new PasswordHasherArgon2();
  const userRepository = new KyselyUserRepository(db);

  // application
  const registerUser = new RegisterUserUseCase(userRepository, passwordHasher);

  return {
    registerUser,
  };
}
