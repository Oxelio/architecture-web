import {
  SessionEntity,
  SessionIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
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
    const createdAt = new Date();
    const lastActivityAt = new Date();
    const session = SessionEntity.rehydrate({
      identifier: id,
      userId,
      expiresAt,
      createdAt,
      lastActivityAt,
    });
    const adapter = new RedisSessionAdapter(redis as never);

    await adapter.save(session);
    expect(redis.set).toHaveBeenCalledWith(
      `session:${id.value}`,
      JSON.stringify({
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
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
        createdAt: createdAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
      }),
    );
    await expect(adapter.findById(id)).resolves.toMatchObject({
      userId,
      expiresAt,
    });

    await adapter.delete(id);
    expect(redis.del).toHaveBeenCalledWith(`session:${id.value}`);
  });

  it("updates session activity without extending its TTL", async () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const createdAt = new Date();
    const lastActivityAt = new Date();
    const record = JSON.stringify({
      userId: userId.value,
      expiresAt: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
    });
    const redis = {
      get: vi.fn().mockResolvedValue(record),
      set: vi.fn(),
    };
    const adapter = new RedisSessionAdapter(redis as never);

    const session = await adapter.findById(id);
    expect(session?.createdAt).toEqual(createdAt);
    expect(session?.lastActivityAt).toEqual(lastActivityAt);

    const activity = new Date();
    await adapter.updateLastActivity(id, activity);
    expect(redis.set).toHaveBeenCalledWith(
      `session:${id.value}`,
      JSON.stringify({
        userId: userId.value,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        lastActivityAt: activity.toISOString(),
      }),
      "KEEPTTL",
    );
  });

  it("rejects incomplete session records instead of migrating them", async () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const redis = {
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          userId: userId.value,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ),
      set: vi.fn(),
    };
    const adapter = new RedisSessionAdapter(redis as never);

    await expect(adapter.findById(id)).resolves.toBeNull();
    await adapter.updateLastActivity(id, new Date());

    expect(redis.set).not.toHaveBeenCalled();
  });
});
