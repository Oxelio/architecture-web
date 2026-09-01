import {
  EmailVerificationTokenHashValueObject,
  EmailVerificationTokenValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { Sha256EmailVerificationTokenHasherAdapter } from "./sha256-email-verification-token-hasher.adapter.js";

describe("Sha256EmailVerificationTokenHasherAdapter", () => {
  it("hashes a verification token using SHA-256", async () => {
    const token = EmailVerificationTokenValueObject.create(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    if (!token.success) {
      throw new Error("Invalid test token");
    }

    const result = await new Sha256EmailVerificationTokenHasherAdapter().hash(
      token.value,
    );

    expect(result.value).toBe(
      "a3a9e1ed9732cab28868127be00f1ce921acaefdd5c3b23a6e9e0072bd9c1a34",
    );
  });

  it("fails if the produced hash cannot be represented", async () => {
    const token = EmailVerificationTokenValueObject.create(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    if (!token.success) {
      throw new Error("Invalid test token");
    }
    vi.spyOn(EmailVerificationTokenHashValueObject, "create").mockReturnValue({
      success: false,
      error: { code: "email_verification_token_hash.invalid_format" },
    });

    await expect(
      new Sha256EmailVerificationTokenHasherAdapter().hash(token.value),
    ).rejects.toThrow("Invalid email verification token hash");
  });
});
