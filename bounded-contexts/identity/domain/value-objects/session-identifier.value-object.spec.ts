// @file bounded-contexts/identity/domain/value-objects/session-identifier.value-object.spec.ts

import { v4 as uuidv4, v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import { SessionIdentifierValueObject } from "./session-identifier.value-object.js";

describe("SessionIdentifierValueObject", () => {
  /* -------------------------------------------------- */
  /* GENERATE                                            */
  /* -------------------------------------------------- */

  it("should generate a valid session identifier", () => {
    const identifier = SessionIdentifierValueObject.generate();

    expect(identifier).toBeInstanceOf(SessionIdentifierValueObject);
    expect(identifier.value).toBeDefined();
  });

  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a valid session identifier", () => {
    const result = SessionIdentifierValueObject.create(uuidv7());

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
    const result = SessionIdentifierValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "session_identifier.empty",
    });
  });

  /* -------------------------------------------------- */
  /* INVALID UUID                                        */
  /* -------------------------------------------------- */

  it("should fail when identifier is not a valid uuid", () => {
    const result = SessionIdentifierValueObject.create("not-a-uuid");

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "session_identifier.invalid_uuid",
    });
  });

  /* -------------------------------------------------- */
  /* INVALID VERSION                                     */
  /* -------------------------------------------------- */

  it("should fail when identifier is not a version 7 uuid", () => {
    const result = SessionIdentifierValueObject.create(uuidv4());

    expect(result.success).toBe(false);

    if (result.success) {
      throw new Error("Expected failure");
    }

    expect(result.error).toEqual({
      code: "session_identifier.invalid_version",
      expected: 7,
    });
  });
});
