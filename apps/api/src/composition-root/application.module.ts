// @file apps/api/src/composition-root/application.module.ts

import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIdentityModule, type IdentityModule } from "./identity.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly identity: IdentityModule;

  dispose(): Promise<void>;
}

export function buildApplicationModule(): ApplicationModule {
  const config = loadConfig();

  const db = createDatabase(config.database);
  const redis = createRedis(config.redis);

  return {
    identity: buildIdentityModule(db, redis, config.smtp),

    async dispose() {
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
