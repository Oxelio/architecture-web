import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { NodemailerNotificationDeliveryAdapter } from "./nodemailer-notification-delivery.adapter.js";

describe("NodemailerNotificationDeliveryAdapter", () => {
  it("uses the delivery destination and escapes the HTML message", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail,
    } as never);
    const adapter = new NodemailerNotificationDeliveryAdapter(
      "smtp.example.test",
      587,
      "user",
      "password",
      "notifications@example.test",
    );

    const severity = NotificationSeverityValueObject.create("warning");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const notification = NotificationEntity.create({
      recipientId: "user-1",
      sourceEventId: "event-1",
      type: "iam.session-started",
      severity: severity.value,
      title: "Security alert",
      message: "A <new> session was opened.",
      deliveries: [{ channel: "email", destination: "user@example.test" }],
    });
    const [delivery] = notification.deliveries;
    if (!delivery) {
      throw new Error("Test fixture is invalid");
    }

    await adapter.send(notification, delivery);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 30_000,
        greetingTimeout: 30_000,
        socketTimeout: 30_000,
        dnsTimeout: 30_000,
      }),
    );

    expect(sendMail).toHaveBeenCalledWith({
      from: "notifications@example.test",
      to: "user@example.test",
      subject: "Security alert",
      html: "<p>A &lt;new&gt; session was opened.</p>",
      text: "A <new> session was opened.",
    });
  });
});
