import { describe, it, expect, beforeEach } from "vitest";

import { GetUserProfileUseCase } from "./get-user-profile.use-case.js";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";
import { EmailValueObject } from "#value-objects/email.value-object";
import type { UserPort } from "#application/ports/user.port";
import type { UserEntity } from "#entities/user.entity";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserPort {
  private readonly users = new Map<string, UserEntity>();

  async findByEmail(_email: EmailValueObject): Promise<UserEntity | null> {
    throw new Error("Method not implemented.");
  }

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("GetUserProfileUseCase", () => {
  let userPort: FakeUserPort;
  let useCase: GetUserProfileUseCase;

  beforeEach(() => {
    userPort = new FakeUserPort();
    useCase = new GetUserProfileUseCase(userPort);
  });

  /* -------------------------------------------------- */
  /* 1. INVALID USER ID FORMAT                          */
  /* -------------------------------------------------- */

  it("should return not_found when userId is invalid", async () => {
    const result = await useCase.execute({
      userId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 2. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should return not_found when user does not exist", async () => {
    const validId = UserIdentifierValueObject.generate().value;

    const result = await useCase.execute({
      userId: validId,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        kind: "not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 3. SUCCESS CASE                                    */
  /* -------------------------------------------------- */

  it("should return user profile when user exists", async () => {
    const userId = UserIdentifierValueObject.generate();
    const email = EmailValueObject.create("test@test.com");

    if (!email.success) {
      throw new Error("Invalid email");
    }

    const user = {
      identifier: userId,
      email: email.value,
    } as UserEntity;

    await userPort.save(user);

    const result = await useCase.execute({
      userId: userId.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        userId: userId.value,
        email: "test@test.com",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. VALUE OBJECT VALIDATION FLOW                   */
  /* -------------------------------------------------- */

  it("should call value object validation and fail early", async () => {
    const result = await useCase.execute({
      userId: "invalid-id",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.kind).toBe("not_found");
    }
  });
});
