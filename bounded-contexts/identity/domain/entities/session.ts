import { Entity } from "@architecture/foundation";
import type { UserIdentifier } from "#value-objects/user-identifier";
import type { SessionIdentifier } from "#value-objects/session-identifier";

interface SessionProperties {
  identifier: SessionIdentifier;
  userId: UserIdentifier;
  expiresAt: Date;
}

export class Session extends Entity<SessionProperties> {}
