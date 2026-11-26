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

  describe("activity updates", () => {
    const id = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const key = `session:${id.value}`;
    const createdAt = new Date("2026-01-01T12:00:00.000Z");
    const expiresAt = new Date("2026-01-01T13:00:00.000Z");
    const activity = new Date("2026-01-01T12:10:00.000Z");
    const record = (lastActivityAt: Date) =>
      JSON.stringify({
        userId: userId.value,
        userSessionVersion: 1,
        expiresAt: expiresAt.toISOString(),
        createdAt: createdAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
      });

    it("conditionally replaces the exact snapshot without extending its TTL", async () => {
      const redis = {
        get: vi.fn().mockResolvedValue(record(createdAt)),
        eval: vi.fn().mockResolvedValue(1),
      };
      const adapter = new RedisSessionAdapter(redis as never);

      const session = await adapter.findById(id);
      expect(session?.createdAt).toEqual(createdAt);
      expect(session?.lastActivityAt).toEqual(createdAt);

      await adapter.updateLastActivity(id, activity);
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining("XX"),
        1,
        key,
        record(createdAt),
        record(activity),
      );
    });

    it.each([null, "invalid JSON", "{}"])(
      "does not update an absent or invalid record (%s)",
      async (snapshot) => {
        const redis = {
          get: vi.fn().mockResolvedValue(snapshot),
          eval: vi.fn(),
        };
        await new RedisSessionAdapter(redis as never).updateLastActivity(
          id,
          activity,
        );
        expect(redis.eval).not.toHaveBeenCalled();
      },
    );

    it("does not update a record with an invalid user identifier", async () => {
      const invalidRecord = record(createdAt).replace(userId.value, "invalid");
      const redis = {
        get: vi.fn().mockResolvedValue(invalidRecord),
        eval: vi.fn().mockResolvedValue(1),
      };
      const adapter = new RedisSessionAdapter(redis as never);

      await expect(adapter.findById(id)).resolves.toBeNull();
      await adapter.updateLastActivity(id, activity);

      expect(redis.eval).not.toHaveBeenCalled();
    });

    it("does not write equal or older activity", async () => {
      const redis = {
        get: vi.fn().mockResolvedValue(record(activity)),
        eval: vi.fn(),
      };
      const adapter = new RedisSessionAdapter(redis as never);
      await adapter.updateLastActivity(id, activity);
      await adapter.updateLastActivity(id, createdAt);
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it("stops when the key disappears before the conditional write", async () => {
      const redis = {
        get: vi.fn().mockResolvedValue(record(createdAt)),
        eval: vi.fn().mockResolvedValue(0),
      };
      await new RedisSessionAdapter(redis as never).updateLastActivity(
        id,
        activity,
      );
      expect(redis.get).toHaveBeenCalledOnce();
      expect(redis.eval).toHaveBeenCalledOnce();
    });

    it("retries against an intervening snapshot if the activity is newer", async () => {
      const intermediate = new Date("2026-01-01T12:05:00.000Z");
      const redis = {
        get: vi
          .fn()
          .mockResolvedValueOnce(record(createdAt))
          .mockResolvedValueOnce(record(intermediate)),
        eval: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
      };
      await new RedisSessionAdapter(redis as never).updateLastActivity(
        id,
        activity,
      );
      expect(redis.eval).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        1,
        key,
        record(intermediate),
        record(activity),
      );
      expect(redis.eval).toHaveBeenCalledTimes(2);
    });

    it("does not overwrite newer activity after a conflict", async () => {
      const newer = new Date("2026-01-01T12:15:00.000Z");
      const redis = {
        get: vi
          .fn()
          .mockResolvedValueOnce(record(createdAt))
          .mockResolvedValueOnce(record(newer)),
        eval: vi.fn().mockResolvedValue(2),
      };
      await new RedisSessionAdapter(redis as never).updateLastActivity(
        id,
        activity,
      );
      expect(redis.get).toHaveBeenCalledTimes(2);
      expect(redis.eval).toHaveBeenCalledOnce();
    });

    it.each(["get", "eval"] as const)(
      "propagates a technical Redis failure from %s",
      async (command) => {
        const error = new Error("Redis unavailable");
        const redis = {
          get: vi.fn().mockResolvedValue(record(createdAt)),
          eval: vi.fn().mockResolvedValue(1),
        };
        redis[command].mockRejectedValueOnce(error);

        await expect(
          new RedisSessionAdapter(redis as never).updateLastActivity(
            id,
            activity,
          ),
        ).rejects.toBe(error);
      },
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
      eval: vi.fn(),
    };
    const adapter = new RedisSessionAdapter(redis as never);

    await expect(adapter.findById(id)).resolves.toBeNull();
    await adapter.updateLastActivity(id, new Date());

    expect(redis.eval).not.toHaveBeenCalled();
  });
});
