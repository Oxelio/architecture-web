import {
  AuthenticatorIdentifierValueObject,
  UserIdentifierValueObject,
} from "@architecture/iam/domain";
import { describe, expect, it } from "vitest";

import { PasswordAuthenticatorMapper } from "./password-authenticator.mapper.js";

const row = {
  id: AuthenticatorIdentifierValueObject.generate().value,
  user_id: UserIdentifierValueObject.generate().value,
  password_hash: "password-hash",
  created_at: new Date("2025-01-01"),
  updated_at: new Date("2025-01-02"),
  last_used_at: null,
  revoked_at: null,
};

describe("PasswordAuthenticatorMapper", () => {
  it("maps a valid row in both directions", () => {
    const authenticator = PasswordAuthenticatorMapper.toDomain(row);

    expect(PasswordAuthenticatorMapper.toPersistence(authenticator)).toEqual(
      row,
    );
  });

  it.each([
    ["id", "invalid"],
    ["user_id", "invalid"],
    ["password_hash", ""],
  ])("rejects invalid persisted %s", (field, value) => {
    expect(() =>
      PasswordAuthenticatorMapper.toDomain({ ...row, [field]: value }),
    ).toThrow();
  });
});
