import { KyselyUserAdapter } from "@architecture/identity/infrastructure";
import type { Kysely } from "kysely";
import type { AppDatabase } from "./database.container.js";
import { GetCurrentUserProfileUseCase } from "@architecture/identity/application";

export function buildProfileContainer(db: Kysely<AppDatabase>) {
  const user = new KyselyUserAdapter(db);

  const getMyProfile = new GetCurrentUserProfileUseCase(user);

  return {
    getMyProfile,
  };
}
