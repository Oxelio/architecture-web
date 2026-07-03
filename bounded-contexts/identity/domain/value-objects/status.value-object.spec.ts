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
    expect(status.isPending()).toBe(false);
  });

  it("should create suspended status", () => {
    const status = StatusValueObject.suspended();

    expect(status.value).toBe("suspended");
    expect(status.isSuspended()).toBe(true);
    expect(status.isActive()).toBe(false);
    expect(status.isPending()).toBe(false);
  });

  it("should create pending status", () => {
    const status = StatusValueObject.pending();

    expect(status.value).toBe("pending");
    expect(status.isPending()).toBe(true);
    expect(status.isActive()).toBe(false);
    expect(status.isSuspended()).toBe(false);
  });

  /* -------------------------------------------------- */
  /* CREATE VALID CASES                                 */
  /* -------------------------------------------------- */

  it("should create status from valid string: active", () => {
    const result = StatusValueObject.create("active");

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.value.value).toBe("active");
  });

  it("should create status from valid string: suspended", () => {
    const result = StatusValueObject.create("suspended");

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.value.value).toBe("suspended");
  });

  it("should create status from valid string: pending", () => {
    const result = StatusValueObject.create("pending");

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.value.value).toBe("pending");
  });

  /* -------------------------------------------------- */
  /* CREATE INVALID CASES                               */
  /* -------------------------------------------------- */

  it("should fail when value is empty", () => {
    const result = StatusValueObject.create("");

    expect(result.success).toBe(false);

    if (result.success) return;

    expect(result.error.kind).toBe("status.empty");
  });

  it("should fail when value is invalid", () => {
    const result = StatusValueObject.create("unknown");

    expect(result.success).toBe(false);

    if (result.success) return;

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

  it("should correctly identify pending status", () => {
    const status = StatusValueObject.pending();

    expect(status.isPending()).toBe(true);
  });
});
