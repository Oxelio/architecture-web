import { describe, it, expect, beforeEach, vi } from "vitest";

import { UserEntity } from "#entities/user.entity";

import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { SignUpUseCase } from "./sign-up.use-case.js";

/* ---------------- FAKE PASSWORD HASHER ---------------- */

class FakePasswordHasherPort {
  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const result = PasswordHashValueObject.create("hashed-" + password.value);

    if (!result.success) {
      throw new Error("Invalid hash");
    }

    return result.value;
  }

  async verify() {
    return true;
  }

  async fakeVerify() {
    /* TODO document why this async method 'fakeVerify' is empty */
  }
}

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort {
  private readonly usersByEmail = new Map<string, UserEntity>();
  private readonly usersById = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.usersByEmail.get(email.value) ?? null;
  }

  async findById(id: any): Promise<UserEntity | null> {
    return this.usersById.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.usersByEmail.set(user.email.value, user);
    this.usersById.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("SignUpUseCase - full coverage", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let useCase: SignUpUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    useCase = new SignUpUseCase(userPort, passwordHasher);
  });

  /* -------------------------------------------------- */
  /* 1. SUCCESS PATH                                   */
  /* -------------------------------------------------- */

  it("should register user successfully", async () => {
    const result = await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBeDefined();
    }
  });

  /* -------------------------------------------------- */
  /* 2. EMAIL INVALID (COVER EMAIL BRANCH)             */
  /* -------------------------------------------------- */

  it("should fail when email is invalid", async () => {
    const result = await useCase.execute({
      email: "invalid-email",
      password: "password123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.kind).toBe("email.invalid_format");
    }
  });

  /* -------------------------------------------------- */
  /* 3. PASSWORD INVALID (COVER PASSWORD BRANCH)       */
  /* -------------------------------------------------- */

  it("should fail when password is invalid", async () => {
    const result = await useCase.execute({
      email: "test@test.com",
      password: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.kind).toBe("password.empty");
    }
  });

  /* -------------------------------------------------- */
  /* 4. USER ALREADY EXISTS                             */
  /* -------------------------------------------------- */

  it("should fail when user already exists", async () => {
    const payload = {
      email: "test@test.com",
      password: "password123",
    };

    // first insert
    await useCase.execute(payload);

    // second should fail
    const result = await useCase.execute(payload);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "user.already_exists",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 5. HASHER CALLED                                  */
  /* -------------------------------------------------- */

  it("should call password hasher", async () => {
    const spy = vi.spyOn(passwordHasher, "hash");

    await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 6. USER SAVED                                     */
  /* -------------------------------------------------- */

  it("should save user", async () => {
    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      email: "test@test.com",
      password: "password123",
    });

    expect(spy).toHaveBeenCalledOnce();
  });
});
