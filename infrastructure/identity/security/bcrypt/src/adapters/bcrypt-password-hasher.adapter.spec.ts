import { PasswordPlainValueObject } from "@architecture/identity/domain";
import { describe, expect, it } from "vitest";

import { BcryptPasswordHasherAdapter } from "./bcrypt-password-hasher.adapter.js";

describe("BcryptPasswordHasherAdapter", () => {
  it("hashes and verifies a valid password", async () => {
    const password = PasswordPlainValueObject.create("A-valid-password-123!");
    if (!password.success) {
      throw new Error("Expected a valid password");
    }

    const adapter = new BcryptPasswordHasherAdapter();
    const hash = await adapter.hash(password.value);

    await expect(adapter.verify(password.value, hash)).resolves.toBe(true);
  });
});
