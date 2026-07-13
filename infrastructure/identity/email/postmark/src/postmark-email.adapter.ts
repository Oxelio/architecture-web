// @file infrastructure/identity/email/postmark/src/postmark-email.adapter.ts

import type { EmailSenderPort } from "@architecture/identity/application";
import type { EmailValueObject } from "@architecture/identity/domain";
import { ServerClient } from "postmark";

export class PostmarkEmailSenderAdapter implements EmailSenderPort {
  private readonly client: ServerClient;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(apiToken: string, fromAddress: string, appUrl: string) {
    this.client = new ServerClient(apiToken);
    this.fromAddress = fromAddress;
    this.appUrl = appUrl;
  }

  async sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify?token=${token}`;

    const subject = "Please verify your email";
    const html = `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`;
    const text = `Open this link to verify your email: ${verifyUrl}`;

    await this.send(to, subject, html, text);
  }

  async send(
    to: EmailValueObject,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    const message = {
      From: this.fromAddress,
      To: to.value,
      Subject: subject,
      HtmlBody: html,
    };

    if (text !== undefined) {
      Object.assign(message, {
        TextBody: text,
      });
    }

    await this.client.sendEmail(message);
  }
}
