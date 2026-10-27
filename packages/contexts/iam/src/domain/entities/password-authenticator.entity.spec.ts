import { describe, expect, it } from "vitest";

import { PasswordHashValueObject } from "#value-objects/password-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { PasswordAuthenticatorEntity } from "./password-authenticator.entity.js";

function hash(value: string) {
  const result = PasswordHashValueObject.create(value);
  if (!result.success) {
    throw new Error("Invalid test hash");
  }
  return result.value;
}

describe("PasswordAuthenticatorEntity", () => {
  it("owns the password hash independently from the user", () => {
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: UserIdentifierValueObject.generate(),
      passwordHash: hash("hash-one"),
    });
    authenticator.changePassword(hash("hash-two"));
    expect(authenticator.passwordHash.value).toBe("hash-two");
    expect(authenticator.pendingDomainEvents).toHaveLength(1);
  });

  it("cannot use a revoked authenticator", () => {
    const authenticator = PasswordAuthenticatorEntity.create({
      userId: UserIdentifierValueObject.generate(),
      passwordHash: hash("hash-one"),
    });
    authenticator.revoke();
    expect(() => authenticator.recordSuccessfulUse()).toThrow("revoked");
  });
});
