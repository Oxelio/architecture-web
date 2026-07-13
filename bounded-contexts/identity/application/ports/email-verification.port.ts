// @file bounded-contexts/identity/application/ports/email-verification.port.ts

import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export interface EmailVerificationRecord {
  token: string;
  userId: UserIdentifierValueObject;
  expiresAt: Date;
  used: boolean;
  invalidated: boolean;
}

export abstract class EmailVerificationPort {
  abstract create(
    userId: UserIdentifierValueObject,
    token: string,
    expiresAt: Date,
  ): Promise<void>;

  abstract findByToken(token: string): Promise<EmailVerificationRecord | null>;

  abstract markUsed(token: string): Promise<void>;

  abstract invalidatePrevious(userId: UserIdentifierValueObject): Promise<void>;
}
