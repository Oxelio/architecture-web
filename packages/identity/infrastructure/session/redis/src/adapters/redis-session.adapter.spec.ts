import {
  SessionEntity,
  SessionIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";
import { describe, expect, it, vi } from "vitest";

import { RedisSessionAdapter } from "./redis-session.adapter.js";

describe("RedisSessionAdapter", () => {
  it("saves, retrieves and deletes a session", async () => {
    const redis = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      zadd: vi.fn(),
      zrem: vi.fn(),
    };
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const session = SessionEntity.rehydrate({
      identifier: id,
      userId,
      expiresAt,
    });
    const adapter = new RedisSessionAdapter(redis as never);

    await adapter.save(session);
    expect(redis.set).toHaveBeenCalledWith(
      `session:${id.value}`,
      JSON.stringify({
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
      }),
      "EX",
      expect.any(Number),
    );
    expect(redis.zadd).toHaveBeenCalledWith(
      `user-sessions:${userId.value}`,
      expiresAt.getTime(),
      id.value,
    );

    redis.get.mockResolvedValueOnce(null);
    await expect(adapter.findById(id)).resolves.toBeNull();
    redis.get.mockResolvedValueOnce(
      JSON.stringify({ userId: "invalid", expiresAt: expiresAt.toISOString() }),
    );
    await expect(adapter.findById(id)).resolves.toBeNull();
    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
      }),
    );
    await expect(adapter.findById(id)).resolves.toMatchObject({
      userId,
      expiresAt,
    });

    await adapter.delete(id);
    expect(redis.del).toHaveBeenCalledWith(`session:${id.value}`);
  });

  it("loads legacy records and updates activity without extending their TTL", async () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const legacyRecord = JSON.stringify({
      userId: userId.value,
      expiresAt: expiresAt.toISOString(),
    });
    const redis = {
      get: vi.fn().mockResolvedValue(legacyRecord),
      set: vi.fn(),
    };
    const adapter = new RedisSessionAdapter(redis as never);

    const session = await adapter.findById(id);
    expect(session?.createdAt).toBeUndefined();
    expect(session?.client).toBeUndefined();

    const activity = new Date();
    await adapter.updateLastActivity(id, activity);
    expect(redis.set).toHaveBeenCalledWith(
      `session:${id.value}`,
      JSON.stringify({
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
        lastActivityAt: activity.toISOString(),
      }),
      "KEEPTTL",
    );
  });
});
