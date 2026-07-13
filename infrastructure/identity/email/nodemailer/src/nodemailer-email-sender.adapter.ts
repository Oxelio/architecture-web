// @file infrastructure/identity/email/nodemailer/src/nodemailer-email-sender.adapter.ts

import type { EmailSenderPort } from "@architecture/identity/application";
import type { EmailValueObject } from "@architecture/identity/domain";
import nodemailer, { type Transporter } from "nodemailer";

export class NodemailerEmailSenderAdapter implements EmailSenderPort {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor(
    host: string,
    port: number,
    user: string,
    password: string,
    fromAddress: string,
    appUrl: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true pour SSL
      auth: {
        user,
        pass: password,
      },
    });

    this.fromAddress = fromAddress;
    this.appUrl = appUrl;
  }

  async sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void> {
    const verifyUrl = `${this.appUrl}/verify?token=${token}`;

    await this.send(
      to,
      "Please verify your email",
      `<p>Click <a href="${verifyUrl}">here</a> to verify your email.</p>`,
      `Open this link: ${verifyUrl}`,
    );
  }

  async send(
    to: EmailValueObject,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: to.value,
      subject,
      html,
      text,
    });
  }
}
