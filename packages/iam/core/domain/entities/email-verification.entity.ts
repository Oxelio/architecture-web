import { AggregateRoot, Identifier } from "@architecture/foundation";

import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

class EmailVerificationIdentifier extends Identifier {
  public static fromTokenHash(tokenHash: string): EmailVerificationIdentifier {
    return new EmailVerificationIdentifier({ value: tokenHash });
  }
}

interface EmailVerificationProperties {
  readonly identifier: Identifier;
  readonly userId: UserIdentifierValueObject;
  readonly tokenHash: EmailVerificationTokenHashValueObject;
  readonly expiresAt: Date;
  used: boolean;
  invalidated: boolean;
}

interface CreateEmailVerificationProperties {
  readonly userId: UserIdentifierValueObject;
  readonly tokenHash: EmailVerificationTokenHashValueObject;
  readonly expiresAt: Date;
}

export class EmailVerificationEntity extends AggregateRoot<EmailVerificationProperties> {
  public static create(
    properties: CreateEmailVerificationProperties,
  ): EmailVerificationEntity {
    return new EmailVerificationEntity({
      userId: properties.userId,
      identifier: EmailVerificationIdentifier.fromTokenHash(
        properties.tokenHash.value,
      ),
      tokenHash: properties.tokenHash,
      expiresAt: properties.expiresAt,
      used: false,
      invalidated: false,
    });
  }

  public static rehydrate(
    properties: Omit<EmailVerificationProperties, "identifier">,
  ): EmailVerificationEntity {
    return new EmailVerificationEntity({
      ...properties,
      identifier: EmailVerificationIdentifier.fromTokenHash(
        properties.tokenHash.value,
      ),
    });
  }

  public get userId(): UserIdentifierValueObject {
    return this.props.userId;
  }

  public get tokenHash(): EmailVerificationTokenHashValueObject {
    return this.props.tokenHash;
  }

  public get expiresAt(): Date {
    return this.props.expiresAt;
  }

  public get isUsed(): boolean {
    return this.props.used;
  }

  public get isInvalidated(): boolean {
    return this.props.invalidated;
  }

  public isExpiredAt(now: Date): boolean {
    return this.props.expiresAt.getTime() < now.getTime();
  }

  public isUsableAt(now: Date): boolean {
    return !this.isUsed && !this.isInvalidated && !this.isExpiredAt(now);
  }

  public consume(): void {
    if (this.isUsed) {
      return;
    }
    this.props.used = true;
  }

  public invalidate(): void {
    if (this.isInvalidated) {
      return;
    }
    this.props.invalidated = true;
  }
}
