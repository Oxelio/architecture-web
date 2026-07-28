import { describe, expect, it } from "vitest";

import { PasswordPlainValueObject } from "./password-plain.value-object.js";

describe("PasswordPlainValueObject", () => {
  it.each([
    "x",
    "une phrase de passe avec des espaces",
    "Mot de passe Unicode 🔐",
    " leading and trailing spaces ",
  ])(
    "preserves supported plaintext exactly for authentication: %s",
    (value) => {
      const result = PasswordPlainValueObject.create(value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.value).toBe(value);
      }
    },
  );

  it("rejects an empty password", () => {
    const result = PasswordPlainValueObject.create("");
    expect(result).toEqual({
      success: false,
      error: { code: "password.empty" },
    });
  });

  it("enforces only the defensive transport limit in Unicode code points", () => {
    const result = PasswordPlainValueObject.create("🔐".repeat(1025));
    expect(result).toEqual({
      success: false,
      error: {
        code: "password.too_long",
        max: 1024,
        actual: 1025,
      },
    });
  });
});
