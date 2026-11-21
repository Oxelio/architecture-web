import { EmailValueObject } from "@architecture/iam/domain";
import { ServerClient } from "postmark";
import { describe, expect, it, vi } from "vitest";

import { PostmarkEmailSenderAdapter } from "./postmark-email.adapter.js";

describe("PostmarkEmailSenderAdapter", () => {
  it("sends a verification email with the configured sender and URL", async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    vi.spyOn(ServerClient.prototype, "sendEmail").mockImplementation(sendEmail);
    const email = EmailValueObject.create("user@example.com");
    if (!email.success) {
      throw new Error("Expected a valid email");
    }

    const adapter = new PostmarkEmailSenderAdapter(
      "token",
      "noreply@example.com",
      "https://app.example.com/verify",
    );
    await adapter.sendVerificationEmail(email.value, "token-123");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "noreply@example.com",
        To: "user@example.com",
        TextBody:
          "Open this link to verify your email: https://app.example.com/verify#token=token-123",
        HtmlBody:
          '<p>Click <a href="https://app.example.com/verify#token=token-123">here</a> to verify your email.</p>',
      }),
    );
  });


  it("preserves configured parameters but removes legacy token query and encodes fragment", async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    vi.spyOn(ServerClient.prototype, "sendEmail").mockImplementation(sendEmail);
    const email = EmailValueObject.create("user@example.com");
    if (!email.success) {
      throw new Error("Expected a valid email");
    }
    const adapter = new PostmarkEmailSenderAdapter(
      "token",
      "noreply@example.com",
      "https://app.example.com/verify?source=email&token=stale",
    );
    await adapter.sendVerificationEmail(email.value, "token with spaces");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        TextBody:
          "Open this link to verify your email: https://app.example.com/verify?source=email#token=token+with+spaces",
      }),
    );
  });

  it("sends a plain email without a text body when none is provided", async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    vi.spyOn(ServerClient.prototype, "sendEmail").mockImplementation(sendEmail);
    const email = EmailValueObject.create("user@example.com");
    if (!email.success) {
      throw new Error("Expected a valid email");
    }

    await new PostmarkEmailSenderAdapter(
      "token",
      "noreply@example.com",
      "https://app.example.com/verify",
    ).send(email.value, "Subject", "<p>Body</p>");

    expect(sendEmail).toHaveBeenCalledWith({
      From: "noreply@example.com",
      To: "user@example.com",
      Subject: "Subject",
      HtmlBody: "<p>Body</p>",
    });
  });
});
