import { EmailValueObject } from "@architecture/identity/domain";
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
          "Open this link to verify your email: https://app.example.com/verify?token=token-123",
      }),
    );
  });
});
