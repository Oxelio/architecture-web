import { UserIdentifierValueObject } from "@architecture/iam/domain";
import { describe, expect, it } from "vitest";

import { UserMapper } from "./user.mapper.js";

const row = {
  id: UserIdentifierValueObject.generate().value,
  email: "user@example.com",
  password_hash: "hash",
  role: "user",
  status: "active",
  is_email_verified: false,
  session_version: 1,
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
    ["session_version", 0],
  ])("rejects invalid persisted %s", (field, value) => {
    expect(() => UserMapper.toDomain({ ...row, [field]: value })).toThrow();
  });
});
