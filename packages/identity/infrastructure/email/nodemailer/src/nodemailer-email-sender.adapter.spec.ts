import { EmailValueObject } from "@architecture/identity/domain";
import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { NodemailerEmailSenderAdapter } from "./nodemailer-email-sender.adapter.js";

describe("NodemailerEmailSenderAdapter", () => {
  it("sends a verification email with the configured sender and URL", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail,
    } as never);
    const email = EmailValueObject.create("user@example.com");
    if (!email.success) {
      throw new Error("Expected a valid email");
    }

    const adapter = new NodemailerEmailSenderAdapter(
      "smtp.example.com",
      587,
      "user",
      "password",
      "noreply@example.com",
      "https://app.example.com",
    );
    await adapter.sendVerificationEmail(email.value, "token-123");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "user@example.com",
        text: "Open this link: https://app.example.com/verify?token=token-123",
      }),
    );
  });
});
