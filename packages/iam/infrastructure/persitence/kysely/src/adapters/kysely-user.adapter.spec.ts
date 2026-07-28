import {
  EmailValueObject,
  PasswordHashValueObject,
  UserEntity,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { KyselyUserAdapter } from "./kysely-user.adapter.js";

const row = {
  id: UserIdentifierValueObject.generate().value,
  email: "user@example.com",
  password_hash: "hash",
  role: "user",
  status: "active",
  is_email_verified: false,
  created_at: new Date(),
  updated_at: new Date(),
};

function dbWith(result: unknown) {
  const execute = vi.fn().mockResolvedValue(undefined);
  const executeTakeFirst = vi.fn().mockResolvedValue(result);
  const chain = {
    values: vi.fn(),
    onConflict: vi.fn(),
    selectAll: vi.fn(),
    where: vi.fn(),
    execute,
    executeTakeFirst,
  };
  chain.values.mockReturnValue(chain);
  chain.onConflict.mockImplementation((callback) => {
    callback({ column: () => ({ doUpdateSet: () => chain }) });
    return chain;
  });
  chain.selectAll.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return {
    insertInto: vi.fn(() => chain),
    selectFrom: vi.fn(() => chain),
    chain,
  };
}

describe("KyselyUserAdapter", () => {
  it("saves a user with an upsert", async () => {
    const db = dbWith(null);
    const email = EmailValueObject.create(row.email);
    const password = PasswordHashValueObject.create(row.password_hash);
    if (!email.success || !password.success) {
      throw new Error("invalid fixture");
    }
    const identifier = UserIdentifierValueObject.create(row.id);
    if (!identifier.success) {
      throw new Error("invalid fixture");
    }
    await new KyselyUserAdapter(db as never).save(
      UserEntity.rehydrate({
        identifier: identifier.value,
        email: email.value,
        password: password.value,
        status: UserEntity.create({
          email: email.value,
          password: password.value,
        }).status,
        isEmailVerified: false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
    expect(db.insertInto).toHaveBeenCalledWith("iam_users");
    expect(db.chain.execute).toHaveBeenCalled();
  });

  it("finds users by email and id or returns null", async () => {
    const email = EmailValueObject.create(row.email);
    const id = UserIdentifierValueObject.create(row.id);
    if (!email.success || !id.success) {
      throw new Error("invalid fixture");
    }
    await expect(
      new KyselyUserAdapter(dbWith(null) as never).findByEmail(email.value),
    ).resolves.toBeNull();
    await expect(
      new KyselyUserAdapter(dbWith(row) as never).findByEmail(email.value),
    ).resolves.toMatchObject({ email: email.value });
    await expect(
      new KyselyUserAdapter(dbWith(null) as never).findById(id.value),
    ).resolves.toBeNull();
    await expect(
      new KyselyUserAdapter(dbWith(row) as never).findById(id.value),
    ).resolves.toMatchObject({ identifier: id.value });
  });
});
