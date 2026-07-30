import { DomainEvent } from "@architecture/foundation";

import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import type { UserRoleValueObject } from "#value-objects/user-role.value-object";

export class UserRegistered extends DomainEvent<
  "iam.user-registered",
  { userId: string }
> {
  constructor(userId: UserIdentifierValueObject) {
    super({
      type: "iam.user-registered",
      aggregateId: userId.value,
      payload: { userId: userId.value },
    });
  }
}

export class UserEmailChanged extends DomainEvent<
  "iam.user-email-changed",
  { userId: string }
> {
  constructor(userId: UserIdentifierValueObject) {
    super({
      type: "iam.user-email-changed",
      aggregateId: userId.value,
      payload: { userId: userId.value },
    });
  }
}

export class UserPasswordChanged extends DomainEvent<
  "iam.user-password-changed",
  { userId: string }
> {
  constructor(userId: UserIdentifierValueObject) {
    super({
      type: "iam.user-password-changed",
      aggregateId: userId.value,
      payload: { userId: userId.value },
    });
  }
}

export class UserRoleChanged extends DomainEvent<
  "iam.user-role-changed",
  { userId: string; actorId?: string; role: string }
> {
  constructor(
    userId: UserIdentifierValueObject,
    role: UserRoleValueObject,
    actorId?: UserIdentifierValueObject,
  ) {
    super({
      type: "iam.user-role-changed",
      aggregateId: userId.value,
      payload: {
        userId: userId.value,
        role: role.value,
        ...(actorId ? { actorId: actorId.value } : {}),
      },
    });
  }
}

export class UserSuspended extends DomainEvent<
  "iam.user-suspended",
  { userId: string; actorId?: string }
> {
  constructor(
    userId: UserIdentifierValueObject,
    actorId?: UserIdentifierValueObject,
  ) {
    super({
      type: "iam.user-suspended",
      aggregateId: userId.value,
      payload: {
        userId: userId.value,
        ...(actorId ? { actorId: actorId.value } : {}),
      },
    });
  }
}

export class UserActivated extends DomainEvent<
  "iam.user-activated",
  { userId: string; actorId?: string }
> {
  constructor(
    userId: UserIdentifierValueObject,
    actorId?: UserIdentifierValueObject,
  ) {
    super({
      type: "iam.user-activated",
      aggregateId: userId.value,
      payload: {
        userId: userId.value,
        ...(actorId ? { actorId: actorId.value } : {}),
      },
    });
  }
}

export class UserEmailVerified extends DomainEvent<
  "iam.user-email-verified",
  { userId: string }
> {
  constructor(userId: UserIdentifierValueObject) {
    super({
      type: "iam.user-email-verified",
      aggregateId: userId.value,
      payload: { userId: userId.value },
    });
  }
}

export class SessionStarted extends DomainEvent<
  "iam.session-started",
  { userId: string; sessionId: string }
> {
  constructor(userId: UserIdentifierValueObject, sessionId: string) {
    super({
      type: "iam.session-started",
      aggregateId: sessionId,
      payload: { userId: userId.value, sessionId },
    });
  }
}
