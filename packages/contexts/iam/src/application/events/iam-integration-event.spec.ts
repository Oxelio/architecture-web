import { DomainEvent } from "@architecture/foundation";
import { describe, expect, it } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { toIamIntegrationEvent } from "./iam-integration-event.js";
import { createIamSecurityEvent } from "./iam-security-event.js";
describe("IAM integration event projection", () => {
  it.each([
    ["iam.user-email-changed", "kind"],
    ["iam.user-email-verified", "kind"],
    ["iam.user-role-changed", "role"],
  ])("validates and allowlists %s", (type, field) => {
    const project = (payload: Record<string, unknown>) =>
      toIamIntegrationEvent(
        new DomainEvent({ type, aggregateId: "account", payload }),
      );
    expect(() => project({ userId: "account" })).toThrow(TypeError);
    const value = field === "kind" ? "email" : "admin";
    expect(
      project({
        userId: "account",
        actorId: "administrator",
        [field]: value,
        secret: "canary",
      }).payload,
    ).toEqual({
      userId: "account",
      [field]: value,
      ...(field === "role" ? { actorId: "administrator" } : {}),
    });
  });
  it.each([
    "iam.user-registered",
    "iam.user-password-changed",
    "iam.user-suspended",
    "iam.user-activated",
  ])("allowlists domain payloads: %s", (type) => {
    const event = new DomainEvent({
      type,
      aggregateId: "user-1",
      payload: {
        userId: "user-1",
        password: "canary-password",
        token: "canary-token",
        sessionId: "canary-bearer",
        authorization: "canary-header",
      },
    });
    expect(toIamIntegrationEvent(event).payload).toEqual({ userId: "user-1" });
  });
  it("does not forward unknown domain facts", () => {
    expect(() =>
      toIamIntegrationEvent(
        new DomainEvent({
          type: "unknown",
          aggregateId: "user-1",
          payload: { userId: "user-1" },
        }),
      ),
    ).toThrow("Unsupported");
  });
  it("projects application facts without credentials or arbitrary metadata", () => {
    const input = {
      type: "mfa.activated" as const,
      userId: "user-1",
      eventId: "event-1",
      occurredAt: new Date(),
      secret: "canary-mfa",
      recoveryCode: "canary-recovery",
    };
    const event = createIamSecurityEvent(input);
    expect(event.payload).toEqual({ userId: "user-1" });
    expect(JSON.stringify(event)).not.toContain("canary");
    const deleted = createIamSecurityEvent({
      type: "account.deletion.executed",
      pseudonymousSubject: "pseudonym",
      eventId: "event-2",
      occurredAt: new Date(),
    });
    expect(deleted.context).toEqual({ actorType: "system" });
    expect(deleted.payload).toEqual({ pseudonymousSubject: "pseudonym" });
  });
  it("publishes a versioned account fact without the session bearer identifier", () => {
    const account = UserIdentifierValueObject.generate(),
      session = SessionEntity.createForUser({
        userId: account,
        userSessionVersion: 1,
        expiresAt: new Date(Date.now() + 60000),
      }),
      event = session.pullDomainEvents()[0];
    if (!event) {
      throw new Error("Missing session event");
    }
    const integration = toIamIntegrationEvent(event);
    expect(integration.version).toBe(2);
    expect(integration.aggregateId).toBe(account.value);
    expect(integration.payload).toEqual({ userId: account.value });
    expect(JSON.stringify(integration)).not.toContain(session.identifier.value);
  });
});
