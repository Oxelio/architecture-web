import { afterEach, expect, it, vi } from "vitest";

import { UserEntity } from "#entities/user.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import {
  InMemoryLoginIdentityRepository,
  InMemoryPasswordAuthenticatorRepository,
  InMemoryUserQueryRepository,
  InMemoryUserRepository,
} from "./in-memory-repositories.js";

afterEach(() => vi.restoreAllMocks());

it("preserves asynchronous rejection when user storage fails", async () => {
  const repository = new InMemoryUserRepository();
  const failure = new Error("Storage unavailable");
  vi.spyOn(repository.values, "set").mockImplementation(() => {
    throw failure;
  });
  const result = repository.save(UserEntity.create());
  expect(result).toBeInstanceOf(Promise);
  await expect(result).rejects.toBe(failure);
});

it("preserves asynchronous rejection when user lookup fails", async () => {
  const repository = new InMemoryUserRepository();
  const failure = new Error("Storage unavailable");
  vi.spyOn(repository.values, "get").mockImplementation(() => {
    throw failure;
  });
  await expect(
    repository.findById(UserIdentifierValueObject.generate()),
  ).rejects.toBe(failure);
});

it("preserves asynchronous rejection when authenticator lookup fails", async () => {
  const repository = new InMemoryPasswordAuthenticatorRepository();
  const failure = new Error("Storage unavailable");
  vi.spyOn(repository.values, "get").mockImplementation(() => {
    throw failure;
  });
  await expect(
    repository.findForUser(UserIdentifierValueObject.generate()),
  ).rejects.toBe(failure);
});

it("preserves asynchronous rejection when account-view lookup fails", async () => {
  const users = new InMemoryUserRepository();
  const repository = new InMemoryUserQueryRepository(
    users,
    new InMemoryLoginIdentityRepository(),
  );
  const failure = new Error("Storage unavailable");
  vi.spyOn(users.values, "get").mockImplementation(() => {
    throw failure;
  });
  await expect(repository.findAccountById("account")).rejects.toBe(failure);
});
