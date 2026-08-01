import { AggregateRoot } from "@architecture/foundation";

import {
  LoginIdentityChanged,
  LoginIdentityVerified,
} from "#domain/events/iam-domain-events";
import type { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export type LoginIdentityVerificationStatus =
  "not_required" | "pending" | "verified";

interface LoginIdentityProperties {
  readonly identifier: LoginIdentityIdentifierValueObject;
  readonly userId: UserIdentifierValueObject;
  login: LoginIdentifierValueObject;
  verificationStatus: LoginIdentityVerificationStatus;
  verifiedAt: Date | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

interface CreateLoginIdentityProperties {
  readonly userId: UserIdentifierValueObject;
  readonly login: LoginIdentifierValueObject;
  readonly verificationRequired: boolean;
}

export class LoginIdentityEntity extends AggregateRoot<LoginIdentityProperties> {
  static create(
    properties: CreateLoginIdentityProperties,
  ): LoginIdentityEntity {
    const now = new Date();
    const requiresVerification =
      properties.verificationRequired && properties.login.kind === "email";
    return new LoginIdentityEntity({
      identifier: LoginIdentityIdentifierValueObject.generate(),
      userId: properties.userId,
      login: properties.login,
      verificationStatus: requiresVerification ? "pending" : "not_required",
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(properties: LoginIdentityProperties): LoginIdentityEntity {
    return new LoginIdentityEntity(properties);
  }

  get userId(): UserIdentifierValueObject {
    return this.properties.userId;
  }

  get login(): LoginIdentifierValueObject {
    return this.properties.login;
  }

  get verificationStatus(): LoginIdentityVerificationStatus {
    return this.properties.verificationStatus;
  }

  get isVerified(): boolean {
    return this.properties.verificationStatus === "verified";
  }

  get isUsable(): boolean {
    return this.properties.verificationStatus !== "pending";
  }

  get verifiedAt(): Date | null {
    return this.properties.verifiedAt;
  }

  get createdAt(): Date {
    return this.properties.createdAt;
  }

  get updatedAt(): Date {
    return this.properties.updatedAt;
  }

  replace(
    login: LoginIdentifierValueObject,
    verificationRequired: boolean,
  ): void {
    if (this.properties.login.equals(login)) {
      return;
    }
    this.properties.login = login;
    this.properties.verificationStatus =
      verificationRequired && login.kind === "email"
        ? "pending"
        : "not_required";
    this.properties.verifiedAt = null;
    this.properties.updatedAt = new Date();
    this.recordDomainEvent(new LoginIdentityChanged(this.userId, login.kind));
  }

  verify(): void {
    if (this.properties.verificationStatus !== "pending") {
      return;
    }
    const now = new Date();
    this.properties.verificationStatus = "verified";
    this.properties.verifiedAt = now;
    this.properties.updatedAt = now;
    this.recordDomainEvent(
      new LoginIdentityVerified(this.userId, this.login.kind),
    );
  }
}
