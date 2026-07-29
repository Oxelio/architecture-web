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
      eval: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
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
      userSessionVersion: 1,
      expiresAt,
      createdAt,
      lastActivityAt,
    });
    const adapter = new RedisSessionAdapter(redis as never);

    await adapter.save(session);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      `session:${id.value}`,
      `user-sessions:${userId.value}`,
      JSON.stringify({
        userId: userId.value,
        userSessionVersion: 1,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
      }),
      expect.any(Number),
      expiresAt.getTime(),
      id.value,
      expect.any(Number),
      0,
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
        userSessionVersion: 1,
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

  it("saves a session and enforces its user limit in one Redis script", async () => {
    const redis = { eval: vi.fn() };
    const userId = UserIdentifierValueObject.generate();
    const session = SessionEntity.createForUser({
      userId,
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const adapter = new RedisSessionAdapter(redis as never);

    await adapter.saveEnforcingMaximum(session, 10);

    expect(redis.eval).toHaveBeenCalledOnce();
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      `session:${session.identifier.value}`,
      `user-sessions:${userId.value}`,
      expect.any(String),
      expect.any(Number),
      session.expiresAt.getTime(),
      session.identifier.value,
      expect.any(Number),
      10,
    );
    await expect(adapter.saveEnforcingMaximum(session, 0)).rejects.toThrow(
      RangeError,
    );
  });

  it("updates session activity without extending its TTL", async () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const createdAt = new Date();
    const lastActivityAt = new Date();
    const record = JSON.stringify({
      userId: userId.value,
      userSessionVersion: 1,
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
        userSessionVersion: 1,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        lastActivityAt: activity.toISOString(),
      }),
      "KEEPTTL",
    );
  });

  it("lists only sessions from the active-session index", async () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const redis = {
      zremrangebyscore: vi.fn(),
      zrangebyscore: vi.fn().mockResolvedValue([id.value]),
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          userId: userId.value,
          userSessionVersion: 1,
          expiresAt: expiresAt.toISOString(),
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        }),
      ),
    };
    const adapter = new RedisSessionAdapter(redis as never);

    await expect(adapter.findActiveForUser(userId)).resolves.toHaveLength(1);

    expect(redis.zremrangebyscore).toHaveBeenCalledWith(
      `user-sessions:${userId.value}`,
      "-inf",
      expect.any(Number),
    );
    expect(redis.zrangebyscore).toHaveBeenCalledWith(
      `user-sessions:${userId.value}`,
      expect.any(Number),
      "+inf",
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
