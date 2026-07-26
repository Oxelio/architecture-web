// @file bounded-contexts/identity/application/ports/session.port.ts

import type { SessionEntity } from "#entities/session.entity";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

export abstract class SessionRepository {
  abstract save(session: SessionEntity): Promise<void>;
  abstract findById(
    id: SessionIdentifierValueObject,
  ): Promise<SessionEntity | null>;
  abstract delete(id: SessionIdentifierValueObject): Promise<void>;
}
