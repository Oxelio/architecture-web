import type { EmailValueObject } from "#value-objects/email.value-object";

export abstract class EmailSenderPort {
  abstract sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void>;

  // generic send method if needed
  abstract send(
    to: EmailValueObject,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void>;
}
