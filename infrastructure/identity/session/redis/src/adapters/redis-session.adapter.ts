// @file infrastructure/identity/session/redis/src/adapters/redis-session.adapter.ts

import type { SessionPort } from "@architecture/identity/application";
import {
  SessionEntity,
  UserIdentifierValueObject,
} from "@architecture/identity/domain";
import type { SessionIdentifierValueObject } from "@architecture/identity/domain";
import type { Redis } from "ioredis";

interface SessionRecord {
  userId: string;
  expiresAt: string;
}

export class RedisSessionAdapter implements SessionPort {
  constructor(private readonly redis: Redis) {}

  async create(session: SessionEntity): Promise<void> {
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
    await this.redis.del(`session:${id.value}`);
  }
}
