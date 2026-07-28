import { describe, expect, it } from "vitest";

import { InvalidPersistenceDataError } from "./invalid-persistence-data.error.js";

describe("InvalidPersistenceDataError", () => {
  it("identifies the invalid entity field and value", () => {
    const error = new InvalidPersistenceDataError("User", "email", "invalid");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("InvalidPersistenceDataError");
    expect(error.message).toBe(
      "Cannot rehydrate User: invalid 'email' value (invalid)",
    );
  });
});
