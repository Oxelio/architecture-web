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
  session_version: 1,
  created_at: new Date(),
  updated_at: new Date(),
};

function dbWith(result: unknown, rows: unknown[] = []) {
  const execute = vi.fn().mockResolvedValue(rows);
  const executeTakeFirst = vi.fn().mockResolvedValue(result);
  const executeTakeFirstOrThrow = vi.fn().mockResolvedValue(result);
  const expression = vi.fn((...parts: unknown[]) => parts);
  const or = vi.fn((parts: unknown[]) => parts);
  const chain = {
    values: vi.fn(),
    onConflict: vi.fn(),
    select: vi.fn(),
    selectAll: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    execute,
    executeTakeFirst,
    executeTakeFirstOrThrow,
  };
  chain.values.mockReturnValue(chain);
  chain.onConflict.mockImplementation((callback) => {
    callback({ column: () => ({ doUpdateSet: () => chain }) });
    return chain;
  });
  chain.select.mockReturnValue(chain);
  chain.selectAll.mockReturnValue(chain);
  chain.where.mockImplementation((predicate) => {
    if (typeof predicate === "function") {
      predicate({ eb: expression, or });
    }
    return chain;
  });
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  return {
    insertInto: vi.fn(() => chain),
    selectFrom: vi.fn(() => chain),
    chain,
    expression,
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
        sessionVersion: 1,
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

  it("applies filters before count and returns a deterministic bounded page", async () => {
    const db = dbWith({ total: "1" }, [row]);

    const result = await new KyselyUserAdapter(db as never).search({
      search: "USER",
      role: "user",
      status: "active",
      isEmailVerified: false,
      page: 2,
      pageSize: 25,
    });

    expect(result).toMatchObject({
      total: 1,
      users: [{ email: { value: "user@example.com" } }],
    });
    expect(db.chain.where).toHaveBeenCalledWith("role", "=", "user");
    expect(db.chain.where).toHaveBeenCalledWith("status", "=", "active");
    expect(db.chain.where).toHaveBeenCalledWith(
      "is_email_verified",
      "=",
      false,
    );
    expect(db.expression).toHaveBeenCalledWith("email", "ilike", "%USER%");
    expect(db.expression).toHaveBeenCalledWith("id", "like", "%USER%");
    expect(db.chain.orderBy).toHaveBeenNthCalledWith(1, "created_at", "desc");
    expect(db.chain.orderBy).toHaveBeenNthCalledWith(2, "id", "desc");
    expect(db.chain.limit).toHaveBeenCalledWith(25);
    expect(db.chain.offset).toHaveBeenCalledWith(25);
  });

  it("returns global administration indicators", async () => {
    const db = dbWith({
      total: "12",
      active: "9",
      suspended: "3",
      administrators: "2",
    });

    await expect(
      new KyselyUserAdapter(db as never).getAdministrationOverview(),
    ).resolves.toEqual({
      total: 12,
      active: 9,
      suspended: 3,
      administrators: 2,
    });
  });
});
