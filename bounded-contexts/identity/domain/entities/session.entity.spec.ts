// @file bounded-contexts/identity/domain/entities/session.entity.spec.ts

import { describe, it, expect } from "vitest";

import { UserIdentifierValueObject } from "../value-objects/user-identifier.value-object.js";
import { SessionIdentifierValueObject } from "../value-objects/session-identifier.value-object.js";
import { SessionEntity } from "./session.entity.js";

describe("SessionEntity", () => {
  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a session with generated identifier and expiration date", () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.createForUser({
      userId,
    });

    expect(session.identifier).toBeDefined();
    expect(session.userId).toBe(userId);
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(session.isValid()).toBe(true);
    expect(session.isExpired()).toBe(false);
  });

  /* -------------------------------------------------- */
  /* REHYDRATE                                           */
  /* -------------------------------------------------- */

  it("should rehydrate a session correctly", () => {
    const identifier = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);

    const session = SessionEntity.rehydrate({
      identifier,
      userId,
      expiresAt,
    });

    expect(session.identifier).toBe(identifier);
    expect(session.userId).toBe(userId);
    expect(session.expiresAt).toBe(expiresAt);
  });

  /* -------------------------------------------------- */
  /* GETTERS                                             */
  /* -------------------------------------------------- */

  it("should expose userId and expiresAt via getters", () => {
    const session = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
    });

    expect(session.userId).toBeDefined();
    expect(session.expiresAt).toBeDefined();
  });

  /* -------------------------------------------------- */
  /* EXPIRATION                                          */
  /* -------------------------------------------------- */

  it("should be expired when expiration date is in the past", () => {
    const session = SessionEntity.rehydrate({
      identifier: SessionIdentifierValueObject.generate(),
      userId: UserIdentifierValueObject.generate(),
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(session.isExpired()).toBe(true);
    expect(session.isValid()).toBe(false);
  });

  it("should be valid when expiration date is in the future", () => {
    const session = SessionEntity.rehydrate({
      identifier: SessionIdentifierValueObject.generate(),
      userId: UserIdentifierValueObject.generate(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(session.isExpired()).toBe(false);
    expect(session.isValid()).toBe(true);
  });
});
