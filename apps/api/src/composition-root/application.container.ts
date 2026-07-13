// @file apps/api/src/composition-root/application.container.ts

// apps/api/src/composition-root/application.container.ts

import { Redis } from "ioredis";
import { createDatabase } from "./database.container.js";
import { buildIdentityContainer } from "./identity.container.js";
import { loadConfig } from "../config/app.config.js";

export function buildApplicationContainer() {
  const config = loadConfig();

  const db = createDatabase(config.database);

  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
  });

  const identity = buildIdentityContainer(db, redis, config);

  return {
    identity,
  };
}
