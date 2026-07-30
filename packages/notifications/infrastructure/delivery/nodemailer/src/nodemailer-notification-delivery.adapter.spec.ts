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

    await adapter.send({
      id: "delivery-1",
      notificationId: "notification-1",
      channel: "email",
      destination: "user@example.test",
      title: "Security alert",
      message: "A <new> session was opened.",
      attempts: 0,
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: "notifications@example.test",
      to: "user@example.test",
      subject: "Security alert",
      html: "<p>A &lt;new&gt; session was opened.</p>",
      text: "A <new> session was opened.",
    });
  });
});
