import {
  PasswordHashValueObject,
  PasswordPlainValueObject,
} from "@architecture/identity/domain";
import { describe, expect, it, vi } from "vitest";

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
    await expect(adapter.verify(password.value, hash)).resolves.toBe(true);
    await expect(adapter.fakeVerify()).resolves.toBeUndefined();
  });

  it("throws when hashing produces an invalid password hash value object", async () => {
    const password = PasswordPlainValueObject.create("A-valid-password-123!");
    if (!password.success) {
      throw new Error("Expected a valid password");
    }
    vi.spyOn(PasswordHashValueObject, "create").mockReturnValue({
      success: false,
      error: { code: "hashed_password.empty" },
    });
    await expect(
      new Argon2PasswordHasherAdapter().hash(password.value),
    ).rejects.toThrow("Invalid password value object");
  });
});
