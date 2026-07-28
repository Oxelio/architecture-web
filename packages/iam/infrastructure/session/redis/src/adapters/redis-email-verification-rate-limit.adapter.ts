// @file infrastructure/iam/session/redis/src/adapters/redis-email-verification-rate-limit.adapter.ts

import type { EmailVerificationRateLimiter } from "@architecture/iam/application";
import type { UserIdentifierValueObject } from "@architecture/iam/domain";
import type { Redis } from "ioredis";

export class RedisEmailVerificationRateLimitAdapter implements EmailVerificationRateLimiter {
  private readonly prefix = "email-verification-rate";

  private readonly cooldownSeconds = 120;

  constructor(private readonly redis: Redis) {}

  async isAllowed(userId: UserIdentifierValueObject): Promise<boolean> {
    const key = `${this.prefix}:${userId.value}`;

    const exists = await this.redis.exists(key);

    return exists === 0;
  }

  async recordSuccess(userId: UserIdentifierValueObject): Promise<void> {
    const key = `${this.prefix}:${userId.value}`;

    await this.redis.set(key, "1", "EX", this.cooldownSeconds);
  }
}
