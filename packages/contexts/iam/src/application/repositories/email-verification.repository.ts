// @file bounded-contexts/iam/application/ports/email-verification.port.ts

import type { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type { LoginIdentityIdentifierValueObject } from "#value-objects/login-identity-identifier.value-object";

export abstract class EmailVerificationRepository {
  abstract save(verification: EmailVerificationEntity): Promise<void>;

  abstract findByToken(
    tokenHash: EmailVerificationTokenHashValueObject,
  ): Promise<EmailVerificationEntity | null>;

  abstract consume(
    tokenHash: EmailVerificationTokenHashValueObject,
    now: Date,
  ): Promise<boolean>;

  abstract invalidatePreviousFor(
    loginIdentityId: LoginIdentityIdentifierValueObject,
  ): Promise<void>;
}
