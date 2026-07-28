// @file bounded-contexts/iam/application/ports/email-verification.port.ts

import type { EmailVerificationEntity } from "#entities/email-verification.entity";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

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
    userId: UserIdentifierValueObject,
  ): Promise<void>;
}
