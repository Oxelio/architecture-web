import type {
  NotificationDelivery,
  PendingDelivery,
} from "@architecture/notifications/application";
import nodemailer, { type Transporter } from "nodemailer";

export class NodemailerNotificationDeliveryAdapter implements NotificationDelivery {
  readonly channel = "email" as const;
  private readonly transporter: Transporter;

  constructor(
    host: string,
    port: number,
    user: string,
    password: string,
    private readonly fromAddress: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
  }

  async send(delivery: PendingDelivery): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: delivery.destination,
      subject: delivery.title,
      html: `<p>${escapeHtml(delivery.message)}</p>`,
      text: delivery.message,
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
