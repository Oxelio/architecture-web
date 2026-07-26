// @file bounded-contexts/identity/domain/value-objects/email.value-object.spec.ts

import { describe, expect, it } from "vitest";

import { EmailValueObject } from "./email.value-object.js";

describe("EmailValueObject", () => {
  /* -------------------------------------------------- */
  /* VALID                                               */
  /* -------------------------------------------------- */

  it("should create a valid email", () => {
    const result = EmailValueObject.create("test@test.com");

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected success");
    }

    expect(result.value.value).toBe("test@test.com");
  });

  it("should normalize email by trimming spaces and lowercasing", () => {
    const result = EmailValueObject.create("  Test@Example.COM  ");

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected success");
    }

    expect(result.value.value).toBe("test@example.com");
  });

  /* -------------------------------------------------- */
  /* EMPTY                                               */
  /* -------------------------------------------------- */

  it("should fail when email is empty", () => {
    const result = EmailValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "email.empty",
    });
  });

  it("should fail when email contains only spaces", () => {
    const result = EmailValueObject.create("     ");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "email.empty",
    });
  });

  /* -------------------------------------------------- */
  /* MAX LENGTH                                          */
  /* -------------------------------------------------- */

  it("should fail when email exceeds maximum length", () => {
    const localPart = "a".repeat(255);
    const email = `${localPart}@test.com`;

    const result = EmailValueObject.create(email);

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "email.too_long",
      max: 254,
    });
  });

  /* -------------------------------------------------- */
  /* INVALID FORMAT                                      */
  /* -------------------------------------------------- */

  it.each([
    "invalid",
    "test",
    "@test.com",
    "test@",
    "test@test",
    "test@.com",
    "test.com",
    "test@@test.com",
  ])("should reject invalid email '%s'", (email) => {
    const result = EmailValueObject.create(email);

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "email.invalid_format",
      value: email.trim().toLowerCase(),
    });
  });
});
