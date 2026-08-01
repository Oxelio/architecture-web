import { describe, expect, it, vi } from "vitest";

import { iamUserMigrations } from "./001_create_iam_users.js";
import { iamEmailVerificationMigrations } from "./002_create_iam_email_verifications.js";
import { iamAggregateConsistencyMigrations } from "./004_add_iam_aggregate_consistency.js";
import { iamAuthenticationMigrations } from "./005_extract_iam_authentication.js";

function database() {
  const execute = vi.fn().mockResolvedValue(undefined);
  const builder = {
    addColumn: vi.fn(),
    addForeignKeyConstraint: vi.fn(),
    dropColumn: vi.fn(),
    dropConstraint: vi.fn(),
    execute,
  };
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
  builder.dropConstraint.mockReturnValue(builder);
  builder.addForeignKeyConstraint.mockImplementation(
    (_name, _columns, _targetTable, _targetColumns, callback) => {
      const constraint = {
        onDelete: () => constraint,
      };
      callback?.(constraint);
      return builder;
    },
  );
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

describe("iam migrations", () => {
  it("registers the authentication extraction migration", () => {
    expect(iamAuthenticationMigrations).toHaveProperty(
      "005_extract_iam_authentication",
    );
  });

  it("creates the user role as part of the initial schema", async () => {
    const db = database();
    const migration = iamUserMigrations["001_create_iam_users"];
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

  it("creates and drops all iam tables", async () => {
    for (const migration of [
      ...Object.values(iamUserMigrations),
      ...Object.values(iamEmailVerificationMigrations),
      ...Object.values(iamAggregateConsistencyMigrations),
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
      expect(db.execute.mock.calls.length).toBeGreaterThanOrEqual(2);
    }
  });
});
