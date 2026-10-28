import type { SessionEntity } from "#entities/session.entity";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class SessionRepository {
  abstract save(session: SessionEntity): Promise<void>;
  abstract saveEnforcingMaximum(
    session: SessionEntity,
    maximumActiveSessions: number,
  ): Promise<void>;
  abstract findById(
    id: SessionIdentifierValueObject,
  ): Promise<SessionEntity | null>;
  abstract delete(id: SessionIdentifierValueObject): Promise<void>;
  abstract deleteAllForUser(userId: UserIdentifierValueObject): Promise<void>;
  abstract updateLastActivity(
    id: SessionIdentifierValueObject,
    lastActivityAt: Date,
  ): Promise<void>;
  abstract findActiveForUser(
    userId: UserIdentifierValueObject,
  ): Promise<readonly SessionEntity[]>;
}
