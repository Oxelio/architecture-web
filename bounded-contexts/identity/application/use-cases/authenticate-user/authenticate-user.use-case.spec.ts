import { describe, it, expect, beforeEach, vi } from "vitest";

import { EmailValueObject } from "#value-objects/email.value-object";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserEntity } from "#entities/user.entity";
import { AuthenticateUserUseCase } from "./authenticate-user.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort {
  users = new Map<string, UserEntity>();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.users.get(email.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.email.value, user);
  }
}

/* ---------------- FAKE PASSWORD HASHER ---------------- */

class FakePasswordHasherPort {
  async hash(
    password: PasswordPlainValueObject,
  ): Promise<PasswordHashValueObject> {
    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + password.value,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    return passwordVO.value;
  }

  async verify(
    password: PasswordPlainValueObject,
    hashed: PasswordHashValueObject,
  ): Promise<boolean> {
    return hashed.value === "hashed-" + password.value;
  }

  async fakeVerify(): Promise<void> {
    // Do nothing
  }
}

describe("AuthenticateUserUseCase", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let useCase: AuthenticateUserUseCase;

  const validEmail = "test@test.com";
  const validPassword = "password123";

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();

    useCase = new AuthenticateUserUseCase(userPort, passwordHasher);
  });

  /* -------------------------------------------------- */
  /* 1. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist and call fakeVerify", async () => {
    const fakeSpy = vi.spyOn(passwordHasher, "fakeVerify");

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("INVALID_CREDENTIALS");
    }

    expect(fakeSpy).toHaveBeenCalledOnce();
  });

  /* -------------------------------------------------- */
  /* 2. WRONG PASSWORD                                  */
  /* -------------------------------------------------- */

  it("should fail when password is invalid", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + validPassword,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.code).toBe("INVALID_CREDENTIALS");
    }
  });

  /* -------------------------------------------------- */
  /* 3. SUCCESS AUTH                                   */
  /* -------------------------------------------------- */

  it("should authenticate user successfully", async () => {
    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + validPassword,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    await userPort.save(user);

    const result = await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBeDefined();
    }
  });

  /* -------------------------------------------------- */
  /* 4. VERIFY CALLED                                  */
  /* -------------------------------------------------- */

  it("should call password verify when user exists", async () => {
    const verifySpy = vi.spyOn(passwordHasher, "verify");

    const emailVO = EmailValueObject.create(validEmail);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const passwordVO = PasswordPlainValueObject.create(
      "hashed-" + validPassword,
    );
    if (!passwordVO.success) {
      throw new Error("Invalid password value object");
    }

    const user = UserEntity.create({
      email: emailVO.value,
      password: passwordVO.value,
    });

    await userPort.save(user);

    await useCase.execute({
      email: validEmail,
      password: validPassword,
    });

    expect(verifySpy).toHaveBeenCalledOnce();
  });
});
