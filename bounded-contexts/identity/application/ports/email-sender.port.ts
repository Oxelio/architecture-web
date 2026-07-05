import type { EmailValueObject } from "#value-objects/email.value-object";

export abstract class EmailSenderPort {
  abstract sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void>;
}
