import { describe, expect, it } from "vitest";

import { Entity } from "./entity.js";
import { Identifier } from "./identifier.js";
import { Result } from "./result.js";
import { ValueObject } from "./value-object.js";

class TestValueObject extends ValueObject<{ value: string }> {}

class TestEntity extends Entity<{ identifier: Identifier }> {}

describe("foundation domain primitives", () => {
  it("compares value objects and entities by their values and type", () => {
    expect(
      new TestValueObject({ value: "a" }).equals(
        new TestValueObject({ value: "a" }),
      ),
    ).toBe(true);

    const identifier = new Identifier({ value: "user-1" });
    expect(
      new TestEntity({ identifier }).equals(new TestEntity({ identifier })),
    ).toBe(true);
    expect(new TestEntity({ identifier }).equals({} as TestEntity)).toBe(false);
  });

  it("creates discriminated success and failure results", () => {
    expect(Result.success("value")).toEqual({ success: true, value: "value" });
    expect(Result.failure("error")).toEqual({ success: false, error: "error" });
  });
});
