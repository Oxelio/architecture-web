import { describe, expect, it } from "vitest";

import { Entity } from "./entity.js";
import { Identifier } from "./identifier.js";
import { Result } from "./result.js";
import { ValueObject } from "./value-object.js";

class TestValueObject extends ValueObject<{ value: string }> {
  static create(properties: { value: string }): TestValueObject {
    return new TestValueObject(properties);
  }
}

class TestEntity extends Entity<{ identifier: Identifier }> {
  static create(properties: { identifier: Identifier }): TestEntity {
    return new TestEntity(properties);
  }
}

class TestIdentifier extends Identifier {
  constructor(value: string) {
    super({ value });
  }
}

describe("foundation domain primitives", () => {
  it("compares value objects and entities by their values and type", () => {
    expect(
      TestValueObject.create({ value: "a" }).equals(
        TestValueObject.create({ value: "a" }),
      ),
    ).toBe(true);

    const identifier = new TestIdentifier("user-1");
    expect(
      TestEntity.create({ identifier }).equals(
        TestEntity.create({ identifier }),
      ),
    ).toBe(true);
    expect(TestEntity.create({ identifier }).equals({} as TestEntity)).toBe(
      false,
    );
  });

  it("creates discriminated success and failure results", () => {
    expect(Result.success("value")).toEqual({ success: true, value: "value" });
    expect(Result.failure("error")).toEqual({ success: false, error: "error" });
  });
});
