// @file apps/api/src/composition-root/application.module.ts

import type { IamApplication } from "@architecture/iam/application";

import { loadConfig } from "#config/app.config";

import { createDatabase } from "./database.module.js";
import { buildIamModule } from "./iam.module.js";
import { createRedis } from "./redis.module.js";

export interface ApplicationModule {
  readonly iam: IamApplication;

  dispose(): Promise<void>;
}

export function buildApplicationModule(): ApplicationModule {
  const config = loadConfig();

  const db = createDatabase(config.database);
  const redis = createRedis(config.redis);

  return {
    iam: buildIamModule(db, redis, config),

    async dispose() {
      await Promise.all([redis.quit(), db.destroy()]);
    },
  };
}
