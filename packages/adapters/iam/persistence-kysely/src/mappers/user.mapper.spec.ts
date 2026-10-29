import { UserIdentifierValueObject } from "@architecture/iam/domain";
import { describe, expect, it } from "vitest";

import { UserMapper } from "./user.mapper.js";

const row = {
  id: UserIdentifierValueObject.generate().value,
  role: "user",
  status: "active",
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
    ["id", "invalid"],
    ["status", "invalid"],
    ["role", "invalid"],
    ["session_version", 0],
  ])("rejects invalid persisted %s", (field, value) => {
    expect(() => UserMapper.toDomain({ ...row, [field]: value })).toThrow();
  });
});
