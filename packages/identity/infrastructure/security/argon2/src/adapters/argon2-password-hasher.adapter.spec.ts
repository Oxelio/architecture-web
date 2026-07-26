import { PasswordPlainValueObject } from "@architecture/identity/domain";
import { describe, expect, it } from "vitest";

import { Argon2PasswordHasherAdapter } from "./argon2-password-hasher.adapter.js";

describe("Argon2PasswordHasherAdapter", () => {
  it("hashes and verifies a valid password", async () => {
    const password = PasswordPlainValueObject.create("A-valid-password-123!");
    if (!password.success) {
      throw new Error("Expected a valid password");
    }

    const adapter = new Argon2PasswordHasherAdapter();
    const hash = await adapter.hash(password.value);

    await expect(adapter.verify(password.value, hash)).resolves.toBe(true);
  });
});
