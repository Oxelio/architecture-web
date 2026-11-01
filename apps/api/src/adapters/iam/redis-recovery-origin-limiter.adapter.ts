import { randomUUID } from "node:crypto";

import type { RecoveryOriginLimiter } from "@architecture/iam/application";
import type { Redis } from "ioredis";

/** Count attempts atomically, independently from asynchronous Audit projection. */
export class RedisRecoveryOriginLimiterAdapter implements RecoveryOriginLimiter {
  constructor(private readonly redis: Redis) {}
  async countRecent(fingerprint: string, since: Date): Promise<number> {
    const count = await this.redis.eval(
      `
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      local count = redis.call('ZCARD', KEYS[1])
      redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
      redis.call('EXPIRE', KEYS[1], 3600)
      return count
    `,
      1,
      `iam:recovery-origin:${fingerprint}`,
      since.getTime(),
      Date.now(),
      randomUUID(),
    );
    if (typeof count !== "number") {
      throw new Error("Invalid recovery origin count");
    }
    return count;
  }
}
