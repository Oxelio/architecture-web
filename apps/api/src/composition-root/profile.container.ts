import { KyselyUserRepository } from "@architecture/identity/infrastructure";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";
import { GetMyProfileUseCase } from "@architecture/identity/application";

export function buildProfileContainer(db: Kysely<AppDatabase>) {
  const user = new KyselyUserRepository(db);

  const getMyProfile = new GetMyProfileUseCase(user);

  return {
    getMyProfile,
  };
}
