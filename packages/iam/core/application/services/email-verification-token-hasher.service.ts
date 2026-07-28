import type { EmailVerificationTokenValueObject } from "#value-objects/email-verification-token.value-object";
import type { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";

export abstract class EmailVerificationTokenHasher {
  abstract hash(
    token: EmailVerificationTokenValueObject,
  ): Promise<EmailVerificationTokenHashValueObject>;
}
