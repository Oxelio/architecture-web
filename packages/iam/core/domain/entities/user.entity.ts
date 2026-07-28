// @file bounded-contexts/iam/domain/entities/user.entity.ts

import { Entity } from "@architecture/foundation";

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
  readonly createdAt: Date;
  updatedAt: Date;
}

interface UserCreationProperties {
  readonly email: EmailValueObject;
  readonly password: PasswordHashValueObject;
}

export class UserEntity extends Entity<UserProperties> {
  public static create(properties: UserCreationProperties): UserEntity {
    const now = new Date();

    return new UserEntity({
      identifier: UserIdentifierValueObject.generate(),
      email: properties.email,
      password: properties.password,
      role: UserRoleValueObject.user(),
      status: StatusValueObject.active(),
      isEmailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static rehydrate(
    props: Omit<UserProperties, "role"> & {
      readonly role?: UserRoleValueObject;
    },
  ): UserEntity {
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
  }

  changePassword(newPassword: PasswordHashValueObject): void {
    this.props.password = newPassword;
    this.touch();
  }

  changeRole(newRole: UserRoleValueObject): void {
    if (newRole.equals(this.props.role)) {
      return;
    }

    this.props.role = newRole;
    this.touch();
  }

  verifyEmail(): void {
    if (this.props.isEmailVerified) {
      return;
    }

    this.props.isEmailVerified = true;
    this.touch();
  }

  suspend(): void {
    if (this.props.status.isSuspended()) {
      return;
    }

    this.props.status = StatusValueObject.suspended();
    this.touch();
  }

  activate(): void {
    if (this.props.status.isActive()) {
      return;
    }

    this.props.status = StatusValueObject.active();
    this.touch();
  }

  // ------------------------
  // Internal helpers
  // ------------------------

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}
