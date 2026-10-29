// @file bounded-contexts/iam/application/use-cases/suspend-user/suspend-user.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdministrator } from "#access-administration/administrator.fixture";
import { AdministratorAuthorizer } from "#access-administration/administrator-authorizer";
import { UserEntity } from "#entities/user.entity";
import type { IamUnitOfWork } from "#ports/iam-unit-of-work";
import type { SessionRepository } from "#ports/session.repository";
import type { UserRepository } from "#ports/user.repository";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SuspendUserUseCase } from "./suspend-user.use-case.js";

/* ---------------- FAKE USER PORT ---------------- */

class FakeUserPort implements UserRepository {
  async hasOtherAdministrativeAccess() {
    return true;
  }
  private readonly users = new Map<string, UserEntity>();

  async findById(id: UserIdentifierValueObject): Promise<UserEntity | null> {
    return this.users.get(id.value) ?? null;
  }

  async save(user: UserEntity): Promise<void> {
    this.users.set(user.identifier.value, user);
  }
}

/* ---------------- TEST SUITE ---------------- */

describe("SuspendUserUseCase", () => {
  let userPort: FakeUserPort;
  let sessionPort: SessionRepository;
  let useCase: SuspendUserUseCase;
  let actorUserId: string;

  beforeEach(async () => {
    userPort = new FakeUserPort();
    const administrator = createAdministrator();
    await userPort.save(administrator);
    actorUserId = administrator.identifier.value;
    sessionPort = { deleteAllForUser: vi.fn() } as unknown as SessionRepository;
    useCase = new SuspendUserUseCase(
      new AdministratorAuthorizer(userPort),
      sessionPort,
      {
        executeForUser: async (
          _id: UserIdentifierValueObject,
          work: Parameters<IamUnitOfWork["execute"]>[0],
        ) => work({ users: userPort, userQueries: userPort } as never),
      } as IamUnitOfWork,
    );
  });

  /* -------------------------------------------------- */
  /* 1. INVALID USER ID FORMAT                          */
  /* -------------------------------------------------- */

  it("should fail when userId is invalid", async () => {
    const result = await useCase.execute({
      actorUserId,
      userId: "",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 2. INVALID UUID FORMAT                             */
  /* -------------------------------------------------- */

  it("should fail when userId is not a valid UUID", async () => {
    const result = await useCase.execute({
      actorUserId,
      userId: "invalid-uuid",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.invalid_id",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 3. USER NOT FOUND                                  */
  /* -------------------------------------------------- */

  it("should fail when user does not exist", async () => {
    const validId = UserIdentifierValueObject.generate().value;

    const result = await useCase.execute({
      actorUserId,
      userId: validId,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toEqual({
        code: "user.not_found",
      });
    }
  });

  /* -------------------------------------------------- */
  /* 4. SUCCESS CASE                                    */
  /* -------------------------------------------------- */

  it("should suspend user when user exists", async () => {
    const user = UserEntity.create();

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toBeUndefined();
    }

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser?.status.isSuspended()).toBe(true);
    expect(sessionPort.deleteAllForUser).toHaveBeenCalledWith(user.identifier);
  });

  /* -------------------------------------------------- */
  /* 5. USER ALREADY SUSPENDED                          */
  /* -------------------------------------------------- */

  it("should not fail when user is already suspended", async () => {
    const user = UserEntity.create();

    user.suspend();

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);
  });

  /* -------------------------------------------------- */
  /* 6. ACTIVE USER                                     */
  /* -------------------------------------------------- */

  it("should suspend active user", async () => {
    const user = UserEntity.create();

    user.activate();

    await userPort.save(user);

    const result = await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(result.success).toBe(true);

    const updatedUser = await userPort.findById(user.identifier);

    expect(updatedUser?.status.isSuspended()).toBe(true);
  });

  /* -------------------------------------------------- */
  /* 7. SAVE CALLED                                     */
  /* -------------------------------------------------- */

  it("should call save on user port", async () => {
    const user = UserEntity.create();

    await userPort.save(user);

    const spy = vi.spyOn(userPort, "save");

    await useCase.execute({
      actorUserId,
      userId: user.identifier.value,
    });

    expect(spy).toHaveBeenCalled();
  });

  it("prevents an administrator from suspending themselves", async () => {
    const result = await useCase.execute({
      userId: actorUserId,
      actorUserId,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "user.self_administration_forbidden" },
    });
  });
});
