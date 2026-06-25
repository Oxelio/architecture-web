import { describe, it, expect } from "vitest";

import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { UserEntity } from "./user.entity.js";

describe("UserEntity", () => {
  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a user with generated identifier", () => {
    const user = UserEntity.create({
      email: EmailValueObject.of("test@test.com"),
      password: PasswordHashValueObject.of("hashed"),
    });

    expect(user.identifier).toBeDefined();
    expect(user.email.value).toBe("test@test.com");
    expect(user.password.value).toBe("hashed");
  });

  /* -------------------------------------------------- */
  /* REHYDRATE                                           */
  /* -------------------------------------------------- */

  it("should rehydrate user correctly", () => {
    const id = UserIdentifierValueObject.generate();

    const user = UserEntity.rehydrate({
      identifier: id,
      email: EmailValueObject.of("rehydrate@test.com"),
      password: PasswordHashValueObject.of("hashed"),
    });

    expect(user.identifier).toBe(id);
    expect(user.email.value).toBe("rehydrate@test.com");
    expect(user.password.value).toBe("hashed");
  });

  /* -------------------------------------------------- */
  /* IMMUTABILITY / GETTERS                              */
  /* -------------------------------------------------- */

  it("should expose email and password via getters", () => {
    const user = UserEntity.create({
      email: EmailValueObject.of("getter@test.com"),
      password: PasswordHashValueObject.of("hashed"),
    });

    expect(user.email).toBeDefined();
    expect(user.password).toBeDefined();
  });
});
