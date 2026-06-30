import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegisterUserUseCase } from "#application/use-cases/register-user/register-user.use-case";
import { PasswordPlainValueObject } from "#value-objects/password-plain.value-object";
import { EmailValueObject } from "#value-objects/email.value-object";
import { UserEntity } from "#entities/user.entity";
import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { PasswordHasherPort } from "#application/index";

class FakePasswordHasherPort extends PasswordHasherPort {
  async hash(password: PasswordPlainValueObject) {
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
    hashedPassword: PasswordHashValueObject,
  ) {
    return hashedPassword.value === "hashed-" + password.value;
  }

  async fakeVerify() {
    // Do nothing
  }
}

class FakeUserPort {
  users = new Map();

  async findByEmail(email: EmailValueObject): Promise<UserEntity | null> {
    return this.users.get(email.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.email.value, user);
  }
}

describe("RegisterUserUseCase", () => {
  let userPort: FakeUserPort;
  let passwordHasher: FakePasswordHasherPort;
  let useCase: RegisterUserUseCase;

  const validPayload = {
    email: "test@test.com",
    password: "password123",
  };

  beforeEach(() => {
    userPort = new FakeUserPort();
    passwordHasher = new FakePasswordHasherPort();
    useCase = new RegisterUserUseCase(userPort, passwordHasher);
  });

  it("should register a new user successfully", async () => {
    const result = await useCase.execute(validPayload);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userId).toBeDefined();
    }

    const emailVO = EmailValueObject.create(validPayload.email);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const stored = await userPort.findByEmail(emailVO.value);

    expect(stored).not.toBeNull();
  });

  it("should fail when user already exists", async () => {
    const emailVO = EmailValueObject.create(validPayload.email);
    if (!emailVO.success) {
      throw new Error("Invalid email value object");
    }

    const hash = PasswordHashValueObject.create("hashed");
    if (!hash.success) {
      throw new Error(`Invalid password value object`);
    }

    const existingUser = UserEntity.create({
      email: emailVO.value,
      password: hash.value,
    });

    await userPort.save(existingUser);

    const result = await useCase.execute(validPayload);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toStrictEqual({
        kind: "user.already_exists",
      });
    }
  });

  it("should call password hasher", async () => {
    const hashSpy = vi.spyOn(passwordHasher, "hash");

    await useCase.execute(validPayload);

    expect(hashSpy).toHaveBeenCalledOnce();
  });

  it("should save user exactly once", async () => {
    const saveSpy = vi.spyOn(userPort, "save");

    await useCase.execute(validPayload);

    expect(saveSpy).toHaveBeenCalledOnce();
  });
});
