import type { Redis } from "ioredis";
import type { EmailVerificationRateLimitPort } from "@architecture/identity/application";

export class RedisEmailVerificationRateLimitAdapter implements EmailVerificationRateLimitPort {
  private readonly prefix = "email-verification-rate";

  private readonly cooldownSeconds = 120;

  constructor(private readonly redis: Redis) {}

  async canSend(userId: string): Promise<boolean> {
    const key = `${this.prefix}:${userId}`;

    const exists = await this.redis.exists(key);

    return exists === 0;
  }

  async registerSend(userId: string): Promise<void> {
    const key = `${this.prefix}:${userId}`;

    await this.redis.set(key, "1", "EX", this.cooldownSeconds);
  }
}
