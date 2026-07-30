// @file infrastructure/iam/email/nodemailer/src/nodemailer-email-sender.adapter.ts

import type { EmailSender } from "@architecture/iam/application";
import type { EmailValueObject } from "@architecture/iam/domain";
import type {
  NotificationDelivery,
  PendingDelivery,
} from "@architecture/notifications";
import nodemailer, { type Transporter } from "nodemailer";

export class NodemailerEmailSenderAdapter
  implements EmailSender, NotificationDelivery
{
  readonly channel = "email" as const;
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly verificationUrl: string;

  constructor(
    host: string,
    port: number,
    user: string,
    password: string,
    fromAddress: string,
    verificationUrl: string,
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
    this.verificationUrl = verificationUrl;
  }

  async sendVerificationEmail(
    to: EmailValueObject,
    token: string,
  ): Promise<void> {
    const verifyUrl = new URL(this.verificationUrl);
    verifyUrl.searchParams.set("token", token);

    await this.send(
      to,
      "Please verify your email",
      `<p>Click <a href="${verifyUrl.href}">here</a> to verify your email.</p>`,
      `Open this link: ${verifyUrl.href}`,
    );
  }

  async sendNotification(delivery: PendingDelivery): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: delivery.destination,
      subject: delivery.title,
      html: `<p>${escapeHtml(delivery.message)}</p>`,
      text: delivery.message,
    });
  }

  async send(delivery: PendingDelivery): Promise<void>;
  async send(
    to: EmailValueObject,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void>;
  async send(
    toOrDelivery: EmailValueObject | PendingDelivery,
    subject?: string,
    html?: string,
    text?: string,
  ): Promise<void> {
    if ("destination" in toOrDelivery) {
      return this.sendNotification(toOrDelivery);
    }
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: toOrDelivery.value,
      subject,
      html,
      text,
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
