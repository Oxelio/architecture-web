// @file infrastructure/iam/session/redis/src/adapters/redis-session.adapter.ts

import type { SessionAdministrationRepository } from "@architecture/iam/application";
import {
  SessionEntity,
  SessionIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import type { Redis } from "ioredis";

interface SessionRecord {
  userId: string;
  expiresAt: string;
  createdAt: string;
  lastActivityAt: string;
  client?: SessionEntity["client"];
  network?: SessionEntity["network"];
}

export class RedisSessionAdapter implements SessionAdministrationRepository {
  constructor(private readonly redis: Redis) {}

  async save(session: SessionEntity): Promise<void> {
    const record: SessionRecord = {
      userId: session.userId.value,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      ...(session.client ? { client: session.client } : {}),
      ...(session.network ? { network: session.network } : {}),
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

    const record = this.parseRecord(data);
    if (!record) {
      return null;
    }

    const userId = UserIdentifierValueObject.create(record.userId);
    if (!userId.success) {
      return null;
    }

    const expiresAt = new Date(record.expiresAt);
    const createdAt = new Date(record.createdAt);
    const lastActivityAt = new Date(record.lastActivityAt);

    return SessionEntity.rehydrate({
      identifier: id,
      userId: userId.value,
      expiresAt,
      createdAt,
      lastActivityAt,
      ...(record.client ? { client: record.client } : {}),
      ...(record.network ? { network: record.network } : {}),
    });
  }

  async updateLastActivity(
    id: SessionIdentifierValueObject,
    lastActivityAt: Date,
  ): Promise<void> {
    const key = `session:${id.value}`;
    const data = await this.redis.get(key);
    if (!data) {
      return;
    }

    const record = this.parseRecord(data);
    if (!record) {
      return;
    }

    await this.redis.set(
      key,
      JSON.stringify({
        ...record,
        lastActivityAt: lastActivityAt.toISOString(),
      }),
      "KEEPTTL",
    );
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

  async findAllForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly SessionEntity[]> {
    const key = this.userSessionsKey(userId);
    const now = Date.now();
    await this.redis.zremrangebyscore(key, "-inf", now);
    const sessionIds = await this.redis.zrangebyscore(key, now, "+inf");
    const sessions = await Promise.all(
      sessionIds.map((sessionId) => {
        const id = SessionIdentifierValueObject.create(sessionId);
        return id.success ? this.findById(id.value) : Promise.resolve(null);
      }),
    );

    return sessions.filter(
      (session): session is SessionEntity => session !== null,
    );
  }

  private userSessionsKey(userId: UserIdentifierValueObject): string {
    return `user-sessions:${userId.value}`;
  }

  private parseRecord(data: string): SessionRecord | null {
    try {
      const record = JSON.parse(data) as Partial<SessionRecord>;
      if (
        typeof record.userId !== "string" ||
        typeof record.expiresAt !== "string" ||
        typeof record.createdAt !== "string" ||
        typeof record.lastActivityAt !== "string" ||
        !this.isValidDate(record.expiresAt) ||
        !this.isValidDate(record.createdAt) ||
        !this.isValidDate(record.lastActivityAt)
      ) {
        return null;
      }

      return record as SessionRecord;
    } catch {
      return null;
    }
  }

  private isValidDate(value: string): boolean {
    return !Number.isNaN(Date.parse(value));
  }
}
