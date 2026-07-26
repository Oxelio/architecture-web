import { describe, expect, it } from "vitest";

import { EmailVerificationTokenValueObject } from "./email-verification-token.value-object.js";
import { UserIdentifierValueObject } from "./user-identifier.value-object.js";

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
    expect(EmailVerificationTokenValueObject.create("")).toMatchObject({
      success: false,
      error: { code: "email_verification_token.empty" },
    });
    expect(
      EmailVerificationTokenValueObject.create("not-a-token").success,
    ).toBe(false);
    expect(
      EmailVerificationTokenValueObject.create(
        UserIdentifierValueObject.generate().value,
      ),
    ).toMatchObject({
      success: false,
      error: { code: "email_verification_token.invalid_version", expected: 4 },
    });
  });
});
