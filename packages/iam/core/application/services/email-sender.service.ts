// @file bounded-contexts/iam/application/ports/email-sender.port.ts

import type { EmailValueObject } from "#value-objects/email.value-object";

export abstract class EmailSender {
  abstract sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void>;
}
