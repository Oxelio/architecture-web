import { describe, it, expect } from "vitest";

import { PasswordHashValueObject } from "./password-hash.value-object.js";

describe("PasswordHashValueObject", () => {
  /* -------------------------------------------------- */
  /* VALID                                               */
  /* -------------------------------------------------- */

  it("should create a hashed password", () => {
    const result = PasswordHashValueObject.create("hashed-password");

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected success");
    }

    expect(result.value.value).toBe("hashed-password");
  });

  /* -------------------------------------------------- */
  /* EMPTY                                               */
  /* -------------------------------------------------- */

  it("should fail when hashed password is empty", () => {
    const result = PasswordHashValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      kind: "hashed_password.empty",
    });
  });
});
