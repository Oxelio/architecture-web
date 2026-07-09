import { describe, it, expect } from "vitest";

import { EmailValueObject } from "../value-objects/email.value-object.js";
import { PasswordHashValueObject } from "../value-objects/password-hash.value-object.js";
import { UserIdentifierValueObject } from "../value-objects/user-identifier.value-object.js";
import { UserEntity } from "./user.entity.js";
import { StatusValueObject } from "../value-objects/status.value-object.js";

describe("UserEntity", () => {
  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a user with generated identifier and default state", () => {
    const emailVO = EmailValueObject.create("test@test.com");
    const passwordVO = PasswordHashValueObject.create("hashed");

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    expect(user.identifier).toBeDefined();
    expect(user.email.value).toBe("test@test.com");
    expect(user.password.value).toBe("hashed");
    expect(user.status.isPending()).toBe(true);
    expect(user.isEmailVerified).toBe(false);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  /* -------------------------------------------------- */
  /* REHYDRATE                                           */
  /* -------------------------------------------------- */

  it("should rehydrate user correctly", () => {
    const id = UserIdentifierValueObject.generate();

    const emailVO = EmailValueObject.create("rehydrate@test.com");
    const passwordVO = PasswordHashValueObject.create("hashed");

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("VO creation failed");
    }

    const status = StatusValueObject.active();
    const now = new Date();

    const user = UserEntity.rehydrate({
      identifier: id,
      email: emailVO.value,
      password: passwordVO.value,
      status,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    expect(user.identifier).toBe(id);
    expect(user.email.value).toBe("rehydrate@test.com");
    expect(user.password.value).toBe("hashed");
    expect(user.status.isActive()).toBe(true);
    expect(user.isEmailVerified).toBe(true);
    expect(user.createdAt).toBe(now);
    expect(user.updatedAt).toBe(now);
  });

  /* -------------------------------------------------- */
  /* GETTERS                                             */
  /* -------------------------------------------------- */

  it("should expose email and password via getters", () => {
    const emailVO = EmailValueObject.create("getter@test.com");
    const passwordVO = PasswordHashValueObject.create("hashed");

    if (!emailVO.success || !passwordVO.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    expect(user.email.value).toBe("getter@test.com");
    expect(user.password.value).toBe("hashed");
  });

  /* -------------------------------------------------- */
  /* EMAIL CHANGE                                        */
  /* -------------------------------------------------- */

  it("should change email and update updatedAt", () => {
    const email1 = EmailValueObject.create("a@test.com");
    const email2 = EmailValueObject.create("b@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email1.success || !email2.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email1.value,
      password: password.value,
    });

    const before = user.updatedAt;
    user.changeEmail(email2.value);

    expect(user.email.value).toBe("b@test.com");
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("should not update email if same email", () => {
    const email = EmailValueObject.create("same@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    const before = user.updatedAt;
    user.changeEmail(email.value);

    expect(user.updatedAt).toBe(before);
  });

  /* -------------------------------------------------- */
  /* PASSWORD CHANGE                                     */
  /* -------------------------------------------------- */

  it("should change password and update updatedAt", () => {
    const email = EmailValueObject.create("test@test.com");
    const p1 = PasswordHashValueObject.create("hash1");
    const p2 = PasswordHashValueObject.create("hash2");

    if (!email.success || !p1.success || !p2.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: p1.value,
    });

    const before = user.updatedAt;
    user.changePassword(p2.value);

    expect(user.password.value).toBe("hash2");
    expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  /* -------------------------------------------------- */
  /* EMAIL VERIFICATION                                  */
  /* -------------------------------------------------- */

  it("should verify email", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    expect(user.isEmailVerified).toBe(false);

    user.verifyEmail();

    expect(user.isEmailVerified).toBe(true);
  });

  it("should not re-verify email if already verified", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.verifyEmail();

    const before = user.updatedAt;
    user.verifyEmail();

    expect(user.updatedAt).toBe(before);
  });

  /* -------------------------------------------------- */
  /* STATUS MANAGEMENT                                   */
  /* -------------------------------------------------- */

  it("should suspend user", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.suspend();

    expect(user.status.isSuspended()).toBe(true);
  });

  it("should not update if already suspended", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.suspend();
    const before = user.updatedAt;

    user.suspend();

    expect(user.updatedAt).toBe(before);
  });

  it("should activate user", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.suspend();
    user.activate();

    expect(user.status.isActive()).toBe(true);
  });

  it("should not update if already active", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    const before = user.updatedAt;
    user.activate();

    expect(user.updatedAt).toStrictEqual(before);
  });

  it("should not activate user if already active", () => {
    const email = EmailValueObject.create("test@test.com");
    const password = PasswordHashValueObject.create("hashed");

    if (!email.success || !password.success) {
      throw new Error("VO creation failed");
    }

    const user = UserEntity.create({
      email: email.value,
      password: password.value,
    });

    user.activate();

    const before = user.updatedAt;

    user.activate();

    expect(user.status.isActive()).toBe(true);
    expect(user.updatedAt).toBe(before);
  });
});
