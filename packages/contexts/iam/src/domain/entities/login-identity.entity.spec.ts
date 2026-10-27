import { describe, expect, it } from "vitest";

import { LoginIdentifierValueObject } from "#value-objects/login-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { LoginIdentityEntity } from "./login-identity.entity.js";

function login(kind: "username" | "email", value: string) {
  const result = LoginIdentifierValueObject.create(kind, value);
  if (!result.success) {
    throw new Error("Invalid test login");
  }
  return result.value;
}

describe("LoginIdentityEntity", () => {
  it("does not require verification for usernames", () => {
    const identity = LoginIdentityEntity.create({
      userId: UserIdentifierValueObject.generate(),
      login: login("username", "Dragon.Blue"),
      verificationRequired: true,
    });
    expect(identity.login.value).toBe("dragon.blue");
    expect(identity.verificationStatus).toBe("not_required");
    expect(identity.isUsable).toBe(true);
  });

  it("requires and completes email verification", () => {
    const identity = LoginIdentityEntity.create({
      userId: UserIdentifierValueObject.generate(),
      login: login("email", "USER@example.com"),
      verificationRequired: true,
    });
    expect(identity.isUsable).toBe(false);
    identity.verify();
    expect(identity.isVerified).toBe(true);
    expect(identity.isUsable).toBe(true);
  });

  it("replaces an identity and resets verification", () => {
    const identity = LoginIdentityEntity.create({
      userId: UserIdentifierValueObject.generate(),
      login: login("email", "first@example.com"),
      verificationRequired: true,
    });
    identity.verify();
    identity.replace(login("email", "second@example.com"), true);
    expect(identity.login.value).toBe("second@example.com");
    expect(identity.verificationStatus).toBe("pending");
  });
});
