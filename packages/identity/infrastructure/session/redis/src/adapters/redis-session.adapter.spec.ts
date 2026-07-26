import {
  SessionEntity,
  SessionIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";
import { describe, expect, it, vi } from "vitest";

import { RedisSessionAdapter } from "./redis-session.adapter.js";

describe("RedisSessionAdapter", () => {
  it("saves, retrieves and deletes a session", async () => {
    const redis = { set: vi.fn(), get: vi.fn(), del: vi.fn() };
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
});
