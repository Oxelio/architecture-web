// @file bounded-contexts/iam/application/ports/email-verification-rate-limit.port.ts

import type { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

export abstract class EmailVerificationRateLimiter {
  abstract isAllowed(userId: UserIdentifierValueObject): Promise<boolean>;
  abstract recordSuccess(userId: UserIdentifierValueObject): Promise<void>;
}
