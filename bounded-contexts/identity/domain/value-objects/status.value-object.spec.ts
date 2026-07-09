import { describe, it, expect } from "vitest";
import { StatusValueObject } from "./status.value-object.js";

describe("StatusValueObject", () => {
  /* -------------------------------------------------- */
  /* FACTORY METHODS                                    */
  /* -------------------------------------------------- */

  it("should create active status", () => {
    const status = StatusValueObject.active();

    expect(status.value).toBe("active");
    expect(status.isActive()).toBe(true);
    expect(status.isSuspended()).toBe(false);
  });

  it("should create suspended status", () => {
    const status = StatusValueObject.suspended();

    expect(status.value).toBe("suspended");
    expect(status.isSuspended()).toBe(true);
    expect(status.isActive()).toBe(false);
  });

  /* -------------------------------------------------- */
  /* CREATE VALID CASES                                 */
  /* -------------------------------------------------- */

  it.each(["active", "suspended", "pending"])(
    "should create status from valid string: %s",
    (status) => {
      const result = StatusValueObject.create(status);

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value.value).toBe(status);
    },
  );

  /* -------------------------------------------------- */
  /* CREATE INVALID CASES                               */
  /* -------------------------------------------------- */

  it("should fail when value is empty", () => {
    const result = StatusValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.kind).toBe("status.empty");
  });

  it("should fail when value is invalid", () => {
    const result = StatusValueObject.create("unknown");

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.error.kind).toBe("status.invalid");
    expect(result.error).toStrictEqual({
      kind: "status.invalid",
      value: "unknown",
    });
  });

  /* -------------------------------------------------- */
  /* BOOLEAN HELPERS                                    */
  /* -------------------------------------------------- */

  it("should correctly identify active status", () => {
    const status = StatusValueObject.active();

    expect(status.isActive()).toBe(true);
  });

  it("should correctly identify suspended status", () => {
    const status = StatusValueObject.suspended();

    expect(status.isSuspended()).toBe(true);
  });
});
