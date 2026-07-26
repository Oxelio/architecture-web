import { describe, expect, it } from "vitest";

import { Identifier } from "./identifier.js";

class TestIdentifier extends Identifier {
  constructor(value: string) {
    super({ value });
  }
}

describe("Identifier", () => {
  it("exposes its value", () => {
    expect(new TestIdentifier("user-1").value).toBe("user-1");
  });
});
