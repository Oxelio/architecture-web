import {
  LoginIdentityIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it } from "vitest";

import { LoginIdentityMapper } from "./login-identity.mapper.js";

const row = {
  id: LoginIdentityIdentifierValueObject.generate().value,
  user_id: UserIdentifierValueObject.generate().value,
  kind: "username",
  normalized_value: "dragon.blue",
  verification_status: "not_required",
  verified_at: null,
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-02"),
};

describe("LoginIdentityMapper", () => {
  it("maps a valid row in both directions", () => {
    const identity = LoginIdentityMapper.toDomain(row);

    expect(LoginIdentityMapper.toPersistence(identity)).toEqual(row);
  });

  it.each([
    ["id", "invalid"],
    ["user_id", "invalid"],
    ["kind", "phone"],
    ["normalized_value", "invalid value"],
    ["verification_status", "unknown"],
  ])("rejects invalid persisted %s", (field, value) => {
    expect(() =>
      LoginIdentityMapper.toDomain({ ...row, [field]: value }),
    ).toThrow();
  });
});
