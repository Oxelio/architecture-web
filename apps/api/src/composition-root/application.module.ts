// @file apps/api/src/composition-root/application.module.ts

import type { IdentityApplication } from "@architecture/identity/application";

import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIdentityModule } from "./identity.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly identity: IdentityApplication;

  dispose(): Promise<void>;
}

export function buildApplicationModule(): ApplicationModule {
  const config = loadConfig();

  const db = createDatabase(config.database);
  const redis = createRedis(config.redis);

  return {
    identity: buildIdentityModule(db, redis, config),

    async dispose() {
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
