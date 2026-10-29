import { AggregateRoot } from "@architecture/foundation";

import { UserPasswordChanged } from "#domain/events/iam-domain-events";
import { AuthenticatorIdentifierValueObject } from "#value-objects/authenticator-identifier.value-object";
import type { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

interface PasswordAuthenticatorProperties {
  readonly identifier: AuthenticatorIdentifierValueObject;
  readonly userId: UserIdentifierValueObject;
  passwordHash: PasswordHashValueObject;
  readonly createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

interface CreatePasswordAuthenticatorProperties {
  readonly userId: UserIdentifierValueObject;
  readonly passwordHash: PasswordHashValueObject;
}

export class PasswordAuthenticatorEntity extends AggregateRoot<PasswordAuthenticatorProperties> {
  static create(
    properties: CreatePasswordAuthenticatorProperties,
  ): PasswordAuthenticatorEntity {
    const now = new Date();
    return new PasswordAuthenticatorEntity({
      identifier: AuthenticatorIdentifierValueObject.generate(),
      userId: properties.userId,
      passwordHash: properties.passwordHash,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
      revokedAt: null,
    });
  }

  static rehydrate(
    properties: PasswordAuthenticatorProperties,
  ): PasswordAuthenticatorEntity {
    return new PasswordAuthenticatorEntity(properties);
  }

  get userId(): UserIdentifierValueObject {
    return this.properties.userId;
  }

  get passwordHash(): PasswordHashValueObject {
    return this.properties.passwordHash;
  }

  get createdAt(): Date {
    return this.properties.createdAt;
  }

  get updatedAt(): Date {
    return this.properties.updatedAt;
  }

  get lastUsedAt(): Date | null {
    return this.properties.lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this.properties.revokedAt;
  }

  get isRevoked(): boolean {
    return this.properties.revokedAt !== null;
  }

  changePassword(passwordHash: PasswordHashValueObject): void {
    if (this.isRevoked) {
      throw new Error("A revoked authenticator cannot change password");
    }
    this.properties.passwordHash = passwordHash;
    this.properties.updatedAt = new Date();
    this.recordDomainEvent(new UserPasswordChanged(this.userId));
  }

  recordSuccessfulUse(now = new Date()): void {
    if (this.isRevoked) {
      throw new Error("A revoked authenticator cannot be used");
    }
    this.properties.lastUsedAt = now;
    this.properties.updatedAt = now;
  }

  revoke(now = new Date()): void {
    if (this.isRevoked) {
      return;
    }
    this.properties.revokedAt = now;
    this.properties.updatedAt = now;
  }
}
