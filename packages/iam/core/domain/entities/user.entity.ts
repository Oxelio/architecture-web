// @file bounded-contexts/iam/domain/entities/user.entity.ts

import { AggregateRoot } from "@architecture/foundation";

import {
  UserActivated,
  UserEmailChanged,
  UserEmailVerified,
  UserPasswordChanged,
  UserRegistered,
  UserRoleChanged,
  UserSuspended,
} from "#domain/events/iam-domain-events";
import type { EmailValueObject } from "#value-objects/email.value-object";
import type { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { StatusValueObject } from "#value-objects/status.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserRoleValueObject } from "#value-objects/user-role.value-object";

interface UserProperties {
  readonly identifier: UserIdentifierValueObject;
  email: EmailValueObject;
  password: PasswordHashValueObject;
  role: UserRoleValueObject;
  status: StatusValueObject;
  isEmailVerified: boolean;
  sessionVersion: number;
  readonly createdAt: Date;
  updatedAt: Date;
}

interface UserCreationProperties {
  readonly email: EmailValueObject;
  readonly password: PasswordHashValueObject;
}

export class UserEntity extends AggregateRoot<UserProperties> {
  public static create(properties: UserCreationProperties): UserEntity {
    const now = new Date();

    const user = new UserEntity({
      identifier: UserIdentifierValueObject.generate(),
      email: properties.email,
      password: properties.password,
      role: UserRoleValueObject.user(),
      status: StatusValueObject.active(),
      isEmailVerified: false,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    user.recordDomainEvent(new UserRegistered(user.identifier));
    return user;
  }

  public static rehydrate(
    props: Omit<UserProperties, "role"> & {
      readonly role?: UserRoleValueObject;
    },
  ): UserEntity {
    if (
      !Number.isSafeInteger(props.sessionVersion) ||
      props.sessionVersion < 1
    ) {
      throw new Error("User session version must be a positive integer");
    }
    return new UserEntity({
      ...props,
      role: props.role ?? UserRoleValueObject.user(),
    });
  }

  // ------------------------
  // Getters
  // ------------------------

  public get email(): EmailValueObject {
    return this.props.email;
  }

  public get password(): PasswordHashValueObject {
    return this.props.password;
  }

  public get role(): UserRoleValueObject {
    return this.props.role;
  }

  public get status(): StatusValueObject {
    return this.props.status;
  }

  public get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }

  public get sessionVersion(): number {
    return this.props.sessionVersion;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ------------------------
  // Business logic
  // ------------------------

  changeEmail(newEmail: EmailValueObject): void {
    if (newEmail.equals(this.props.email)) {
      return;
    }

    this.props.email = newEmail;
    this.props.isEmailVerified = false;
    this.touch();
    this.recordDomainEvent(new UserEmailChanged(this.identifier));
  }

  changePassword(newPassword: PasswordHashValueObject): void {
    this.props.password = newPassword;
    this.props.sessionVersion += 1;
    this.touch();
    this.recordDomainEvent(new UserPasswordChanged(this.identifier));
  }

  changeRole(
    newRole: UserRoleValueObject,
    actorId?: UserIdentifierValueObject,
  ): void {
    if (newRole.equals(this.props.role)) {
      return;
    }

    this.props.role = newRole;
    this.touch();
    this.recordDomainEvent(
      new UserRoleChanged(this.identifier, newRole, actorId),
    );
  }

  verifyEmail(): void {
    if (this.props.isEmailVerified) {
      return;
    }

    this.props.isEmailVerified = true;
    this.touch();
    this.recordDomainEvent(new UserEmailVerified(this.identifier));
  }

  suspend(actorId?: UserIdentifierValueObject): void {
    if (this.props.status.isSuspended()) {
      return;
    }

    this.props.status = StatusValueObject.suspended();
    this.touch();
    this.recordDomainEvent(new UserSuspended(this.identifier, actorId));
  }

  activate(actorId?: UserIdentifierValueObject): void {
    if (this.props.status.isActive()) {
      return;
    }

    this.props.status = StatusValueObject.active();
    this.touch();
    this.recordDomainEvent(new UserActivated(this.identifier, actorId));
  }

  // ------------------------
  // Internal helpers
  // ------------------------

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
