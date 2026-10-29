import { describe, expect, it } from "vitest";

import { EmailVerificationTokenHashValueObject } from "./email-verification-token-hash.value-object.js";

describe("EmailVerificationTokenHashValueObject", () => {
  it("accepts a SHA-256 hexadecimal hash", () => {
    const result = EmailVerificationTokenHashValueObject.create("a".repeat(64));

    expect(result).toMatchObject({ success: true });
    if (result.success) {
      expect(result.value.value).toBe("a".repeat(64));
    }
  });

  it("rejects empty and malformed hashes", () => {
    expect(EmailVerificationTokenHashValueObject.create("")).toMatchObject({
      success: false,
      error: { code: "email_verification_token_hash.empty" },
    });
    expect(
      EmailVerificationTokenHashValueObject.create("invalid"),
    ).toMatchObject({
      success: false,
      error: { code: "email_verification_token_hash.invalid_format" },
    });
    expect(
      EmailVerificationTokenHashValueObject.create("A".repeat(64)),
    ).toMatchObject({
      success: false,
    });
  });
});
