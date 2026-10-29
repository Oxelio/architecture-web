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
