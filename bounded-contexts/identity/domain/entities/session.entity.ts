import { Entity } from "@architecture/foundation";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";

interface SessionProperties {
  readonly identifier: SessionIdentifierValueObject;
  readonly userId: UserIdentifierValueObject;
  readonly expiresAt: Date;
}

interface SessionPropertiesCreationProperties {
  readonly userId: UserIdentifierValueObject;
}

export class SessionEntity extends Entity<SessionProperties> {
  private static readonly SESSION_LIFETIME_MINUTES = 60;

  public static createForUser(properties: SessionPropertiesCreationProperties) {
    return new SessionEntity({
      userId: properties.userId,
      expiresAt: SessionEntity.expirationDate(),
      identifier: SessionIdentifierValueObject.generate(),
    });
  }

  public static rehydrate(props: SessionProperties) {
    return new SessionEntity(props);
  }

  public get userId(): UserIdentifierValueObject {
    return this.props.userId;
  }

  public get expiresAt(): Date {
    return this.props.expiresAt;
  }

  public isExpired(): boolean {
    return this.props.expiresAt.getTime() <= Date.now();
  }

  private static expirationDate(): Date {
    return new Date(Date.now() + this.SESSION_LIFETIME_MINUTES * 60 * 1000);
  }
}
