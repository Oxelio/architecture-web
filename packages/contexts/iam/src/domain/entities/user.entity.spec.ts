import { describe, expect, it } from "vitest";

import { UserRoleValueObject } from "#value-objects/user-role.value-object";

import { UserEntity } from "./user.entity.js";

describe("UserEntity", () => {
  it("creates a minimal active user", () => {
    const user = UserEntity.create();

    expect(user.identifier.value).toBeTruthy();
    expect(user.status.value).toBe("active");
    expect(user.role.value).toBe("user");
    expect(user.sessionVersion).toBe(1);
    expect(user.pendingDomainEvents).toHaveLength(1);
  });

  it("rehydrates persisted state", () => {
    const source = UserEntity.create();
    const user = UserEntity.rehydrate({
      identifier: source.identifier,
      role: UserRoleValueObject.admin(),
      status: source.status,
      sessionVersion: 4,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    });

    expect(user.role.value).toBe("admin");
    expect(user.sessionVersion).toBe(4);
    expect(user.pendingDomainEvents).toHaveLength(0);
  });

  it("invalidates every older session by incrementing its version", () => {
    const user = UserEntity.create();
    user.invalidateSessions();
    expect(user.sessionVersion).toBe(2);
  });

  it("changes role and records the transition", () => {
    const user = UserEntity.create();
    user.pullDomainEvents();
    user.changeRole(UserRoleValueObject.admin());

    expect(user.role.value).toBe("admin");
    expect(user.pendingDomainEvents).toHaveLength(1);
  });

  it("suspends and activates the account", () => {
    const user = UserEntity.create();
    user.suspend();
    expect(user.status.value).toBe("suspended");
    user.activate();
    expect(user.status.value).toBe("active");
  });

  it("rejects invalid persisted session versions", () => {
    const source = UserEntity.create();
    expect(() =>
      UserEntity.rehydrate({
        identifier: source.identifier,
        status: source.status,
        sessionVersion: 0,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      }),
    ).toThrow("positive integer");
  });
});
