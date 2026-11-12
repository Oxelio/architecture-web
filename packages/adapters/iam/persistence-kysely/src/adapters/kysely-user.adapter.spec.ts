import {
  UserEntity,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it, vi } from "vitest";

import { KyselyUserAdapter } from "./kysely-user.adapter.js";

const row = {
  id: UserIdentifierValueObject.generate().value,
  role: "user",
  status: "active",
  session_version: 1,
  created_at: new Date(),
  updated_at: new Date(),
};

function dbWith(result: unknown, rows: unknown[] = []) {
  const chain = {
    values: vi.fn(),
    onConflict: vi.fn(),
    leftJoin: vi.fn(),
    select: vi.fn(),
    selectAll: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    execute: vi.fn().mockResolvedValue(rows),
    executeTakeFirst: vi.fn().mockResolvedValue(result),
    executeTakeFirstOrThrow: vi.fn().mockResolvedValue(result),
  };
  chain.values.mockReturnValue(chain);
  chain.onConflict.mockImplementation((callback) => {
    callback({ column: () => ({ doUpdateSet: () => chain }) });
    return chain;
  });
  chain.leftJoin.mockImplementation((_table, callback) => {
    const join = { onRef: vi.fn(), on: vi.fn() };
    join.onRef.mockReturnValue(join);
    join.on.mockReturnValue(join);
    callback(join);
    return chain;
  });
  chain.select.mockReturnValue(chain);
  chain.selectAll.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return {
    insertInto: vi.fn(() => chain),
    selectFrom: vi.fn(() => chain),
    chain,
  };
}

describe("KyselyUserAdapter", () => {
  it.each([
    [
      { id: row.id, email: "user@example.test" },
      { id: row.id, email: "user@example.test" },
    ],
    [
      { id: row.id, email: null },
      { id: row.id, email: null },
    ],
    [undefined, null],
  ])(
    "projects only the verified email of an existing recipient: %j",
    async (result, expected) => {
      const db = dbWith(result);
      await expect(
        new KyselyUserAdapter(db as never).findRecipientContact(row.id),
      ).resolves.toEqual(expected);
      expect(db.chain.select).toHaveBeenCalledWith([
        "user.id",
        "email_identity.normalized_value as email",
      ]);
      expect(db.chain.where).toHaveBeenCalledExactlyOnceWith(
        "user.id",
        "=",
        row.id,
      );
    },
  );

  it.each([true, false])(
    "checks current active administrator membership: %s",
    async (eligible) => {
      const db = dbWith(eligible ? { id: row.id } : undefined);
      await expect(
        new KyselyUserAdapter(db as never).isActiveAdministrator(row.id),
      ).resolves.toBe(eligible);
      expect(db.chain.where.mock.calls).toEqual([
        ["role", "=", "admin"],
        ["status", "=", "active"],
        ["id", "=", row.id],
      ]);
    },
  );

  it("lists only the IDs returned by the active administrator query", async () => {
    const db = dbWith(undefined, [{ id: row.id }]);
    await expect(
      new KyselyUserAdapter(db as never).listActiveAdministratorIds(),
    ).resolves.toEqual([row.id]);
    expect(db.chain.where.mock.calls).toEqual([
      ["role", "=", "admin"],
      ["status", "=", "active"],
    ]);
  });

  it("saves only the minimal user aggregate", async () => {
    const db = dbWith(null);
    await new KyselyUserAdapter(db as never).save(UserEntity.create());
    expect(db.insertInto).toHaveBeenCalledWith("iam_users");
    expect(db.chain.values).toHaveBeenCalledWith(
      expect.not.objectContaining({ email: expect.anything() }),
    );
    expect(db.chain.execute).toHaveBeenCalledOnce();
  });

  it("finds the user aggregate by its internal identifier", async () => {
    const id = UserIdentifierValueObject.create(row.id);
    if (!id.success) {
      throw new Error("Invalid identifier fixture");
    }
    await expect(
      new KyselyUserAdapter(dbWith(row) as never).findById(id.value),
    ).resolves.toMatchObject({ identifier: id.value });
    await expect(
      new KyselyUserAdapter(dbWith(null) as never).findById(id.value),
    ).resolves.toBeNull();
  });

  it("projects account identifiers separately from the aggregate", async () => {
    const db = dbWith(row, [
      {
        kind: "username",
        normalized_value: "dragon.blue",
        verification_status: "not_required",
      },
    ]);
    await expect(
      new KyselyUserAdapter(db as never).findAccountById(row.id),
    ).resolves.toMatchObject({
      userId: row.id,
      identifiers: [{ kind: "username", value: "dragon.blue" }],
    });
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
