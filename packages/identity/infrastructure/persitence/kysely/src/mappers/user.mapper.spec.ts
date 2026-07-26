import { UserIdentifierValueObject } from "@architecture/identity/domain";
import { describe, expect, it } from "vitest";

import { UserMapper } from "./user.mapper.js";

const row = {
  id: UserIdentifierValueObject.generate().value,
  email: "user@example.com",
  password_hash: "hash",
  role: "user",
  status: "pending",
  is_email_verified: false,
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-02"),
};

describe("UserMapper", () => {
  it("maps a valid row in both directions", () => {
    const user = UserMapper.toDomain(row);
    expect(UserMapper.toPersistence(user)).toEqual(row);
  });

  it.each([
    ["email", "invalid"],
    ["password_hash", ""],
    ["id", "invalid"],
    ["status", "invalid"],
    ["role", "invalid"],
  ])("rejects invalid persisted %s", (field, value) => {
    expect(() => UserMapper.toDomain({ ...row, [field]: value })).toThrow();
  });
});
