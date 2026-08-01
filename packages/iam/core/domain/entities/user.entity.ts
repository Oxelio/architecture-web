// @file bounded-contexts/iam/domain/entities/user.entity.ts

import { AggregateRoot } from "@architecture/foundation";

import {
  UserActivated,
  UserRegistered,
  UserRoleChanged,
  UserSuspended,
} from "#domain/events/iam-domain-events";
import { StatusValueObject } from "#value-objects/status.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

interface UserProperties {
  readonly identifier: UserIdentifierValueObject;
  role: UserRoleValueObject;
  status: StatusValueObject;
  sessionVersion: number;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class UserEntity extends AggregateRoot<UserProperties> {
  public static create(): UserEntity {
    const now = new Date();

    const user = new UserEntity({
      identifier: UserIdentifierValueObject.generate(),
      role: UserRoleValueObject.user(),
      status: StatusValueObject.active(),
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    user.recordDomainEvent(new UserRegistered(user.identifier));
    return user;
  }

  public static rehydrate(
    properties: Omit<UserProperties, "role"> & {
      readonly role?: UserRoleValueObject;
    },
  ): UserEntity {
    if (
      !Number.isSafeInteger(properties.sessionVersion) ||
      properties.sessionVersion < 1
    ) {
      throw new Error("User session version must be a positive integer");
    }
    return new UserEntity({
      ...properties,
      role: properties.role ?? UserRoleValueObject.user(),
    });
  }

  // ------------------------
  // Getters
  // ------------------------

  public get role(): UserRoleValueObject {
    return this.properties.role;
  }

  public get status(): StatusValueObject {
    return this.properties.status;
  }

  public get sessionVersion(): number {
    return this.properties.sessionVersion;
  }

  public get createdAt(): Date {
    return this.properties.createdAt;
  }

  public get updatedAt(): Date {
    return this.properties.updatedAt;
  }

  // ------------------------
  // Business logic
  // ------------------------

  invalidateSessions(): void {
    this.properties.sessionVersion += 1;
    this.touch();
  }

  changeRole(
    newRole: UserRoleValueObject,
    actorId?: UserIdentifierValueObject,
  ): void {
    if (newRole.equals(this.properties.role)) {
      return;
    }

    this.properties.role = newRole;
    this.touch();
    this.recordDomainEvent(
      new UserRoleChanged(this.identifier, newRole, actorId),
    );
  }

  suspend(actorId?: UserIdentifierValueObject): void {
    if (this.properties.status.isSuspended()) {
      return;
    }

    this.properties.status = StatusValueObject.suspended();
    this.touch();
    this.recordDomainEvent(new UserSuspended(this.identifier, actorId));
  }

  activate(actorId?: UserIdentifierValueObject): void {
    if (this.properties.status.isActive()) {
      return;
    }

    this.properties.status = StatusValueObject.active();
    this.touch();
    this.recordDomainEvent(new UserActivated(this.identifier, actorId));
  }

  // ------------------------
  // Internal helpers
  // ------------------------

  private touch(): void {
    this.properties.updatedAt = new Date();
  }
}
