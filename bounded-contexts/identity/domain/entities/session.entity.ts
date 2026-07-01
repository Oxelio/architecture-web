import { Entity } from "@architecture/foundation";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { SessionPolicy } from "#policies/session.policy";

interface SessionProperties {
  readonly identifier: SessionIdentifierValueObject;
  readonly userId: UserIdentifierValueObject;
  readonly expiresAt: Date;
}

interface SessionPropertiesCreationProperties {
  readonly userId: UserIdentifierValueObject;
}

export class SessionEntity extends Entity<SessionProperties> {
  static createForUser(properties: SessionPropertiesCreationProperties) {
    return new SessionEntity({
      ...properties,
      expiresAt: SessionPolicy.expiresAt(),
      identifier: SessionIdentifierValueObject.generate(),
    });
  }

  static rehydrate(props: SessionProperties) {
    return new SessionEntity(props);
  }

  get userId(): UserIdentifierValueObject {
    return this.props.userId;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  isExpired(): boolean {
    return this.props.expiresAt.getTime() <= Date.now();
  }

  isValid(): boolean {
    return !this.isExpired();
  }
}
