import { describe, expect, it } from "vitest";

import { SessionEntity } from "#entities/session.entity";
import { UserIdentifierValueObject } from "#value-objects/user-identifier.value-object";

import { toIamIntegrationEvent } from "./iam-integration-event.js";
describe("IAM integration event projection", () => {
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
