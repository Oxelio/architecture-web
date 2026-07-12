import { describe, it, expect } from "vitest";
import { v4 as uuidv4, v7 as uuidv7, validate, version } from "uuid";

import { UserIdentifierValueObject } from "./user-identifier.value-object.js";

describe("UserIdentifierValueObject", () => {
  /* -------------------------------------------------- */
  /* GENERATE                                            */
  /* -------------------------------------------------- */

  it("should generate a valid user identifier", () => {
    const identifier = UserIdentifierValueObject.generate();

    expect(identifier).toBeInstanceOf(UserIdentifierValueObject);
    expect(identifier.value).toBeDefined();
  });

  it("should generate a version 7 uuid", () => {
    const identifier = UserIdentifierValueObject.generate();

    expect(validate(identifier.value)).toBe(true);
    expect(version(identifier.value)).toBe(7);
  });

  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a valid user identifier from uuid v7", () => {
    const result = UserIdentifierValueObject.create(uuidv7());

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error("Expected success");
    }

    expect(result.value.value).toBeDefined();
  });

  /* -------------------------------------------------- */
  /* EMPTY                                               */
  /* -------------------------------------------------- */

  it("should fail when identifier is empty", () => {
    const result = UserIdentifierValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "user_identifier.empty",
    });
  });

  /* -------------------------------------------------- */
  /* INVALID UUID                                        */
  /* -------------------------------------------------- */

  it("should fail when identifier is not a valid uuid", () => {
    const result = UserIdentifierValueObject.create("not-a-uuid");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "user_identifier.invalid_uuid",
    });
  });

  /* -------------------------------------------------- */
  /* INVALID VERSION                                     */
  /* -------------------------------------------------- */

  it("should fail when identifier is not a version 7 uuid", () => {
    const result = UserIdentifierValueObject.create(uuidv4());

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "user_identifier.invalid_version",
      expected: 7,
    });
  });
});
