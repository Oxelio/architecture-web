import { describe, expect, it } from "vitest";

import { EmailVerificationTokenHashValueObject } from "#value-objects/email-verification-token-hash.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { EmailVerificationEntity } from "./email-verification.entity.js";

const tokenHash = EmailVerificationTokenHashValueObject.create("a".repeat(64));
if (!tokenHash.success) {
  throw new Error("Invalid test hash");
}

describe("EmailVerificationEntity", () => {
  it("creates, consumes, invalidates, and evaluates usability", () => {
    const entity = EmailVerificationEntity.create({
      userId: UserIdentifierValueObject.generate(),
      tokenHash: tokenHash.value,
      expiresAt: new Date(Date.now() + 1_000),
    });

    expect(entity.isUsableAt(new Date())).toBe(true);
    expect(entity.isExpiredAt(new Date(Date.now() + 2_000))).toBe(true);
    entity.consume();
    entity.consume();
    entity.invalidate();
    entity.invalidate();
    expect(entity.isUsed).toBe(true);
    expect(entity.isInvalidated).toBe(true);
    expect(entity.userId.value).toBeTruthy();
    expect(entity.expiresAt).toBeInstanceOf(Date);
    expect(entity.isUsableAt(new Date())).toBe(false);
  });

  it("rehydrates persisted state", () => {
    const entity = EmailVerificationEntity.rehydrate({
      userId: UserIdentifierValueObject.generate(),
      tokenHash: tokenHash.value,
      expiresAt: new Date(),
      used: true,
      invalidated: false,
    });

    expect(entity.isUsed).toBe(true);
    expect(entity.isInvalidated).toBe(false);
    expect(entity.tokenHash).toBe(tokenHash.value);
    expect(entity.userId.value).toBeTruthy();
    expect(entity.expiresAt).toBeInstanceOf(Date);
  });
});
