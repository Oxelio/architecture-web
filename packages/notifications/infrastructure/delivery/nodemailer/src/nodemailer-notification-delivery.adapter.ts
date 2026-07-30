import { NotificationDelivery } from "@architecture/notifications/application";
import type {
  NotificationDeliveryEntity,
  NotificationEntity,
} from "@architecture/notifications/domain";
import nodemailer, { type Transporter } from "nodemailer";

export class NodemailerNotificationDeliveryAdapter extends NotificationDelivery {
  readonly channel = "email" as const;
  private readonly transporter: Transporter;

  constructor(
    host: string,
    port: number,
    user: string,
    password: string,
    private readonly fromAddress: string,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
  }

  async send(
    notification: NotificationEntity,
    delivery: NotificationDeliveryEntity,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: delivery.destination,
      subject: notification.title,
      html: `<p>${escapeHtml(notification.message)}</p>`,
      text: notification.message,
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
