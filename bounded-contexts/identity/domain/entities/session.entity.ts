import { Entity } from "@architecture/foundation";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import type { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

interface SessionProperties {
  identifier: SessionIdentifierValueObject;
  userId: UserIdentifierValueObject;
  expiresAt: Date;
}

export class SessionEntity extends Entity<SessionProperties> {}
