import { describe, it, expect } from "vitest";

import { PasswordPlainValueObject } from "./password-plain.value-object.js";

describe("PasswordPlainValueObject", () => {
  /* -------------------------------------------------- */
  /* VALID                                               */
  /* -------------------------------------------------- */

  it("should create a valid password", () => {
    const result = PasswordPlainValueObject.create("Password123!");

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected success");
    }

    expect(result.value.value).toBe("Password123!");
  });

  /* -------------------------------------------------- */
  /* EMPTY                                               */
  /* -------------------------------------------------- */

  it("should fail when password is empty", () => {
    const result = PasswordPlainValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      kind: "password.empty",
    });
  });

  /* -------------------------------------------------- */
  /* TOO SHORT                                           */
  /* -------------------------------------------------- */

  it("should fail when password is too short", () => {
    const password = "Pass1!";

    const result = PasswordPlainValueObject.create(password);

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      kind: "password.too_short",
      min: 8,
      actual: password.length,
    });
  });

  /* -------------------------------------------------- */
  /* TOO LONG                                            */
  /* -------------------------------------------------- */

  it("should fail when password is too long", () => {
    const password = "A".repeat(33);

    const result = PasswordPlainValueObject.create(password);

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      kind: "password.too_long",
      max: 32,
      actual: password.length,
    });
  });

  /* -------------------------------------------------- */
  /* INVALID FORMAT                                      */
  /* -------------------------------------------------- */

  it.each(["Password é1", "Password😊1", "Password\n1", "Password\t1"])(
    "should reject invalid password '%s'",
    (password) => {
      const result = PasswordPlainValueObject.create(password);

      expect(result.success).toBe(false);

      if (result.success) {
        throw new Error("Expected failure");
      }

      expect(result.error).toEqual({
        kind: "password.invalid_format",
        value: password,
      });
    },
  );
});
