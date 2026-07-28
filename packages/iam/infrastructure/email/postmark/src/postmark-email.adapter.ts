// @file infrastructure/iam/email/postmark/src/postmark-email.adapter.ts

import type { EmailSender } from "@architecture/iam/application";
import type { EmailValueObject } from "@architecture/iam/domain";
import { ServerClient } from "postmark";

export class PostmarkEmailSenderAdapter implements EmailSender {
  private readonly client: ServerClient;
  private readonly fromAddress: string;
  private readonly verificationUrl: string;

  constructor(apiToken: string, fromAddress: string, verificationUrl: string) {
    this.client = new ServerClient(apiToken);
    this.fromAddress = fromAddress;
    this.verificationUrl = verificationUrl;
  }

  async sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void> {
    const verifyUrl = new URL(this.verificationUrl);
    verifyUrl.searchParams.set("token", token);

    const subject = "Please verify your email";
    const html = `<p>Click <a href="${verifyUrl.href}">here</a> to verify your email.</p>`;
    const text = `Open this link to verify your email: ${verifyUrl.href}`;

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
