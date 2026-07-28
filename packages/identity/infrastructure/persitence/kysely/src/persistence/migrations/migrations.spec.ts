import { describe, expect, it, vi } from "vitest";

import { identityUserMigrations } from "./001_create_identity_users.js";
import { identityEmailVerificationMigrations } from "./002_create_identity_email_verifications.js";

function database() {
  const execute = vi.fn().mockResolvedValue(undefined);
  const builder = { addColumn: vi.fn(), dropColumn: vi.fn(), execute };
  builder.addColumn.mockImplementation((_name, _type, callback) => {
    const column = {
      primaryKey: () => column,
      notNull: () => column,
      unique: () => column,
      defaultTo: () => column,
    };
    callback?.(column);
    return builder;
  });
  builder.dropColumn.mockReturnValue(builder);
  return {
    schema: {
      createTable: vi.fn(() => builder),
      dropTable: vi.fn(() => ({ execute })),
      alterTable: vi.fn(() => builder),
    },
    builder,
    execute,
  };
}

describe("identity migrations", () => {
  it("creates the user role as part of the initial schema", async () => {
    const db = database();
    const migration = identityUserMigrations["001_create_identity_users"];
    if (!migration?.up) {
      throw new Error("Expected the initial user migration");
    }

    await migration.up(db as never);

    expect(db.builder.addColumn).toHaveBeenCalledWith(
      "role",
      "varchar",
      expect.any(Function),
    );
    expect(db.schema.alterTable).not.toHaveBeenCalled();
  });

  it("creates and drops all identity tables", async () => {
    for (const migration of [
      ...Object.values(identityUserMigrations),
      ...Object.values(identityEmailVerificationMigrations),
    ]) {
      const db = database();
      if (!migration.up || !migration.down) {
        throw new Error("Expected migration to define up and down operations");
      }
      await migration.up(db as never);
      await migration.down(db as never);
      expect(
        db.schema.createTable.mock.calls.length +
          db.schema.alterTable.mock.calls.length,
      ).toBeGreaterThan(0);
      expect(
        db.schema.dropTable.mock.calls.length +
          db.schema.alterTable.mock.calls.length,
      ).toBeGreaterThan(0);
      expect(db.execute).toHaveBeenCalledTimes(2);
    }
  });
});
