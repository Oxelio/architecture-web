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
    const emailVO = EmailValueObject.create("test@test.com");
    if (!emailVO.success) {
      throw new Error("EmailValueObject creation failed");
    }

    const passwordVO = PasswordHashValueObject.create("hashed");
    if (!passwordVO.success) {
      throw new Error("PasswordHashValueObject creation failed");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
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

    const emailVO = EmailValueObject.create("rehydrate@test.com");
    if (!emailVO.success) {
      throw new Error("EmailValueObject creation failed");
    }

    const passwordVO = PasswordHashValueObject.create("hashed");
    if (!passwordVO.success) {
      throw new Error("PasswordHashValueObject creation failed");
    }

    const user = UserEntity.rehydrate({
      identifier: id,
      email: emailVO.value,
      password: passwordVO.value,
    });

    expect(user.identifier).toBe(id);
    expect(user.email.value).toBe("rehydrate@test.com");
    expect(user.password.value).toBe("hashed");
  });

  /* -------------------------------------------------- */
  /* IMMUTABILITY / GETTERS                              */
  /* -------------------------------------------------- */

  it("should expose email and password via getters", () => {
    const emailVO = EmailValueObject.create("getter@test.com");
    if (!emailVO.success) {
      throw new Error("EmailValueObject creation failed");
    }

    const passwordVO = PasswordHashValueObject.create("hashed");
    if (!passwordVO.success) {
      throw new Error("PasswordHashValueObject creation failed");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    expect(user.email).toBeDefined();
    expect(user.password).toBeDefined();
  });
});
