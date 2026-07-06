import { Entity } from "@architecture/foundation";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import type { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { EmailValueObject } from "#value-objects/email.value-object";
import { StatusValueObject } from "#value-objects/status.value-object";

interface UserProperties {
  readonly identifier: UserIdentifierValueObject;
  email: EmailValueObject;
  password: PasswordHashValueObject;
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
      status: StatusValueObject.pending(),
      isEmailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static rehydrate(props: UserProperties): UserEntity {
    return new UserEntity(props);
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
    if (newEmail.equals(this.props.email)) return;

    this.props.email = newEmail;
    this.touch();
  }

  changePassword(newPassword: PasswordHashValueObject): void {
    this.props.password = newPassword;
    this.touch();
  }

  verifyEmail(): void {
    if (this.props.isEmailVerified) return;

    this.props.isEmailVerified = true;
    this.touch();
  }

  suspend(): void {
    if (this.props.status.isSuspended()) return;

    this.props.status = StatusValueObject.suspended();
    this.touch();
  }

  activate(): void {
    if (this.props.status.isActive()) return;

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
