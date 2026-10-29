// @file apps/api/src/composition-root/redis.module.ts

import { Redis } from "ioredis";

import type { AppConfig } from "#config/app.config";

export function createRedis(config: AppConfig["redis"]) {
  return new Redis({
    host: config.host,
    port: config.port,
  });
}
