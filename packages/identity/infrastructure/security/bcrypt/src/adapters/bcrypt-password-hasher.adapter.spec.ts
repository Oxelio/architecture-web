import {
  PasswordHashValueObject,
  PasswordPlainValueObject,
} from "@architecture/identity/domain";
import bcrypt from "bcrypt";
import { describe, expect, it, vi } from "vitest";

import { BcryptPasswordHasherAdapter } from "./bcrypt-password-hasher.adapter.js";

describe("BcryptPasswordHasherAdapter", () => {
  it("hashes and verifies a valid password", async () => {
    const password = PasswordPlainValueObject.create("A-valid-password-123!");
    if (!password.success) {
      throw new Error("Expected a valid password");
    }

    const adapter = new BcryptPasswordHasherAdapter();
    const hash = await adapter.hash(password.value);

    expect(hash.value).toMatch(/^bcrypt-sha256:\$2/);
    await expect(adapter.verify(password.value, hash)).resolves.toBe(true);
    await expect(adapter.fakeVerify()).resolves.toBeUndefined();
  });

  it("does not silently truncate passwords beyond bcrypt's 72-byte limit", async () => {
    const prefix = "🔐".repeat(30);
    const first = PasswordPlainValueObject.create(prefix + "first");
    const second = PasswordPlainValueObject.create(prefix + "second");
    if (!first.success || !second.success) {
      throw new Error("Expected valid long passwords");
    }

    const adapter = new BcryptPasswordHasherAdapter();
    const hash = await adapter.hash(first.value);

    await expect(adapter.verify(first.value, hash)).resolves.toBe(true);
    await expect(adapter.verify(second.value, hash)).resolves.toBe(false);
  });

  it("continues to verify legacy bcrypt hashes", async () => {
    const password = PasswordPlainValueObject.create("legacy password");
    if (!password.success) {
      throw new Error("Expected a valid password");
    }
    const legacyHash = PasswordHashValueObject.create(
      await bcrypt.hash(password.value.value, 4),
    );
    if (!legacyHash.success) {
      throw new Error("Expected a valid hash");
    }

    await expect(
      new BcryptPasswordHasherAdapter().verify(
        password.value,
        legacyHash.value,
      ),
    ).resolves.toBe(true);
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
      new BcryptPasswordHasherAdapter().hash(password.value),
    ).rejects.toThrow("Invalid password hash value object");
  });
});
