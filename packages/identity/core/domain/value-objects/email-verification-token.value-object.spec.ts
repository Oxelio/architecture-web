import { describe, expect, it } from "vitest";

import { EmailVerificationTokenValueObject } from "./email-verification-token.value-object.js";

describe("EmailVerificationTokenValueObject", () => {
  it("generates a valid UUID v4 token", () => {
    const token = EmailVerificationTokenValueObject.generate();

    const result = EmailVerificationTokenValueObject.create(token.value);

    expect(result.success).toBe(true);
    expect(token.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects malformed and non-v4 UUID values", () => {
    expect(
      EmailVerificationTokenValueObject.create("not-a-token").success,
    ).toBe(false);
    expect(
      EmailVerificationTokenValueObject.create(
        "018f6f0a-7c3b-7d9a-8f9c-123456789abc",
      ).success,
    ).toBe(false);
  });
});
