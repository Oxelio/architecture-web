import { UserIdentifierValueObject } from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { RedisEmailVerificationRateLimitAdapter } from "./redis-email-verification-rate-limit.adapter.js";

describe("RedisEmailVerificationRateLimitAdapter", () => {
  it("uses a namespaced key and cooldown when recording a success", async () => {
    const redis = {
      exists: vi.fn().mockResolvedValue(0),
      set: vi.fn().mockResolvedValue("OK"),
    };
    const userId = UserIdentifierValueObject.generate();

    const adapter = new RedisEmailVerificationRateLimitAdapter(redis as never);

    await expect(adapter.isAllowed(userId)).resolves.toBe(true);
    await adapter.recordSuccess(userId);

    expect(redis.exists).toHaveBeenCalledWith(
      `email-verification-rate:${userId.value}`,
    );
    expect(redis.set).toHaveBeenCalledWith(
      `email-verification-rate:${userId.value}`,
      "1",
      "EX",
      120,
    );
  });
});
