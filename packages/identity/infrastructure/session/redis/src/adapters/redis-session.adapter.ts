// @file infrastructure/identity/session/redis/src/adapters/redis-session.adapter.ts

import type { SessionRepository } from "@architecture/identity/application";
import type { SessionIdentifierValueObject } from "@architecture/identity/domain";
import {
  SessionEntity,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";
import type { Redis } from "ioredis";

interface SessionRecord {
  userId: string;
  expiresAt: string;
}

export class RedisSessionAdapter implements SessionRepository {
  constructor(private readonly redis: Redis) {}

  async save(session: SessionEntity): Promise<void> {
    const record: SessionRecord = {
      userId: session.userId.value,
      expiresAt: session.expiresAt.toISOString(),
    };

    const ttl = Math.max(
      1,
      Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
    );

    await this.redis.set(
      `session:${session.identifier.value}`,
      JSON.stringify(record),
      "EX",
      ttl,
    );
    await this.redis.zadd(
      this.userSessionsKey(session.userId),
      session.expiresAt.getTime(),
      session.identifier.value,
    );
  }

  async findById(
    id: SessionIdentifierValueObject,
  ): Promise<SessionEntity | null> {
    const data = await this.redis.get(`session:${id.value}`);
    if (!data) {
      return null;
    }

    const record: SessionRecord = JSON.parse(data);

    const userId = UserIdentifierValueObject.create(record.userId);
    if (!userId.success) {
      return null;
    }

    return SessionEntity.rehydrate({
      identifier: id,
      userId: userId.value,
      expiresAt: new Date(record.expiresAt),
    });
  }

  async delete(id: SessionIdentifierValueObject): Promise<void> {
    const session = await this.findById(id);
    await this.redis.del(`session:${id.value}`);
    if (session) {
      await this.redis.zrem(this.userSessionsKey(session.userId), id.value);
    }
  }

  async deleteAllForUser(userId: UserIdentifierValueObject): Promise<void> {
    const key = this.userSessionsKey(userId);
    const now = Date.now();
    await this.redis.zremrangebyscore(key, "-inf", now);
    const sessionIds = await this.redis.zrangebyscore(key, now, "+inf");

    if (sessionIds.length > 0) {
      const pipeline = this.redis.multi();
      for (const sessionId of sessionIds) {
        pipeline.del(`session:${sessionId}`);
      }
      pipeline.del(key);
      await pipeline.exec();
    }
  }

  private userSessionsKey(userId: UserIdentifierValueObject): string {
    return `user-sessions:${userId.value}`;
  }
}
