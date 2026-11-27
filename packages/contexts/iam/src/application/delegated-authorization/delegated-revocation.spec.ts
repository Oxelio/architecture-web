import { expect, it } from "vitest";

import { createDelegatedRevocationFact } from "./delegated-revocation.js";

it("assigns one durable revocation identity per operation and subject", () => {
  const input = {
    userId: "account-a",
    operationId: "disable-client",
    occurredAt: new Date("2026-01-01T00:00:00Z"),
    actor: { actorType: "administrator", actorId: "administrator" },
    reason: "client_disabled",
    affectedGrantCount: 3,
    clientId: "client",
  } as const;

  const group = createDelegatedRevocationFact(input);
  expect(createDelegatedRevocationFact(input)).toEqual(group);
  expect(
    createDelegatedRevocationFact({ ...input, userId: "account-b" }).eventId,
  ).not.toBe(group.eventId);
  expect(
    createDelegatedRevocationFact({ ...input, operationId: "later-disable" })
      .eventId,
  ).not.toBe(group.eventId);
  expect(group.aggregateId).toBe(input.userId);
  expect(group.context).toEqual({
    actorType: "administrator",
    actorId: "administrator",
    subjectId: "account-a",
  });
  expect(group.payload).toEqual({
    userId: "account-a",
    operationId: "disable-client",
    reason: "client_disabled",
    affectedGrantCount: 3,
    clientId: "client",
  });
  expect(() =>
    createDelegatedRevocationFact({ ...input, affectedGrantCount: 0 }),
  ).toThrow();
});
