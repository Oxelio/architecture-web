// @file bounded-contexts/iam/domain/entities/session.entity.spec.ts

import { describe, expect, it } from "vitest";

import { SessionIdentifierValueObject } from "#value-objects/session-identifier.value-object";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { SessionEntity } from "./session.entity.js";

describe("SessionEntity", () => {
  /* -------------------------------------------------- */
  /* CREATE                                              */
  /* -------------------------------------------------- */

  it("should create a session with generated identifier and expiration date", () => {
    const userId = UserIdentifierValueObject.generate();

    const session = SessionEntity.createForUser({
      userId,
      userSessionVersion: 3,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(session.identifier).toBeDefined();
    expect(session.userId).toBe(userId);
    expect(session.userSessionVersion).toBe(3);
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(session.isValid()).toBe(true);
    expect(session.isExpired()).toBe(false);
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.lastActivityAt).toBeInstanceOf(Date);
  });

  it("requires the caller to provide a future expiration", () => {
    expect(() =>
      SessionEntity.createForUser({
        userId: UserIdentifierValueObject.generate(),
        userSessionVersion: 1,
        expiresAt: new Date(Date.now() - 1),
      }),
    ).toThrow("Session expiration must be in the future");
  });

  it("requires a positive user session version", () => {
    expect(() =>
      SessionEntity.createForUser({
        userId: UserIdentifierValueObject.generate(),
        userSessionVersion: 0,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toThrow("User session version must be a positive integer");
  });

  it("should keep client and network identification metadata", () => {
    const session = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
      client: {
        type: "browser",
        name: "Firefox",
        version: "128",
        deviceType: "desktop",
        operatingSystem: { name: "Linux" },
      },
      network: {
        ipAddress: "192.0.2.10",
        location: { country: "France", city: "Paris" },
      },
    });

    expect(session.client?.name).toBe("Firefox");
    expect(session.network?.location?.city).toBe("Paris");
  });

  /* -------------------------------------------------- */
  /* REHYDRATE                                           */
  /* -------------------------------------------------- */

  it("should rehydrate a session correctly", () => {
    const identifier = SessionIdentifierValueObject.generate();
    const userId = UserIdentifierValueObject.generate();
    const expiresAt = new Date(Date.now() + 60_000);
    const createdAt = new Date();
    const lastActivityAt = new Date();

    const session = SessionEntity.rehydrate({
      identifier,
      userId,
      userSessionVersion: 1,
      expiresAt,
      createdAt,
      lastActivityAt,
    });

    expect(session.identifier).toBe(identifier);
    expect(session.userId).toBe(userId);
    expect(session.expiresAt).toBe(expiresAt);
    expect(session.createdAt).toBe(createdAt);
    expect(session.lastActivityAt).toBe(lastActivityAt);
  });

  /* -------------------------------------------------- */
  /* GETTERS                                             */
  /* -------------------------------------------------- */

  it("should expose userId and expiresAt via getters", () => {
    const session = SessionEntity.createForUser({
      userId: UserIdentifierValueObject.generate(),
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
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
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() - 1_000),
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    expect(session.isExpired()).toBe(true);
    expect(session.isValid()).toBe(false);
  });

  it("should be valid when expiration date is in the future", () => {
    const session = SessionEntity.rehydrate({
      identifier: SessionIdentifierValueObject.generate(),
      userId: UserIdentifierValueObject.generate(),
      userSessionVersion: 1,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    expect(session.isExpired()).toBe(false);
    expect(session.isValid()).toBe(true);
  });
});
