import { randomUUID } from "node:crypto";

import {
  type AuditEventConsumer,
  AuditIntegrationEventHandler,
} from "@architecture/audit/application";
import {
  createIamSecurityEvent,
  toIamIntegrationEvent,
} from "@architecture/iam/application";
import { SessionEntity, UserEntity } from "@architecture/iam/domain";
import {
  NotificationEventHandlerUseCase,
  type NotificationPreferenceRepository,
  type NotificationRepository,
} from "@architecture/notifications/application";
import {
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

function consumers(userId: string) {
  const record = vi
    .fn<AuditEventConsumer["record"]>()
    .mockResolvedValue(undefined);
  const removeAccountReferences = vi
    .fn<AuditEventConsumer["removeAccountReferences"]>()
    .mockResolvedValue(undefined);
  const audit = new AuditIntegrationEventHandler(
    { record, removeAccountReferences },
    { getRetentionDays: async () => 365 },
  );
  const createForEvent = vi
    .fn<NotificationRepository["createForEvent"]>()
    .mockResolvedValue(undefined);
  const identifier = NotificationRecipientIdentifierValueObject.create(userId);
  if (!identifier.success) {
    throw new Error("Invalid fixture recipient");
  }
  const findUser = vi.fn().mockResolvedValue(
    NotificationRecipientEntity.create({
      identifier: identifier.value,
      email: "recipient@example.test",
      phoneNumber: null,
    }),
  );
  const notifications = new NotificationEventHandlerUseCase(
    {
      hasConsumedEvent: vi.fn().mockResolvedValue(false),
      createForEvent,
    } as unknown as NotificationRepository,
    {
      find: vi.fn().mockResolvedValue(null),
    } as unknown as NotificationPreferenceRepository,
    {
      findUser,
      listAdministratorIds: vi.fn().mockResolvedValue([]),
      isActiveAdministrator: vi.fn().mockResolvedValue(false),
      readAffectedUserDeliveryEligibility: vi
        .fn()
        .mockResolvedValue("eligible"),
    },
    [],
  );
  return {
    audit,
    notifications,
    record,
    removeAccountReferences,
    createForEvent,
    findUser,
  };
}

describe("IAM producer compatibility with Audit and Notifications", () => {
  it.each([
    ["registration", 1],
    ["session", 2],
    ["mfa", 1],
  ] as const)(
    "accepts the actual %s producer fact at version %d",
    async (kind, version) => {
      const user = UserEntity.create();
      const userId = user.identifier.value;
      const session =
        kind === "session"
          ? SessionEntity.createForUser({
              userId: user.identifier,
              userSessionVersion: 1,
              expiresAt: new Date(Date.now() + 60_000),
            })
          : undefined;
      const domainFact = (session ?? user).pullDomainEvents()[0];
      if (!domainFact) {
        throw new Error("Missing producer domain fact");
      }
      const fact =
        kind === "mfa"
          ? createIamSecurityEvent({
              type: "mfa.activated",
              userId,
              eventId: randomUUID(),
              occurredAt: new Date(),
            })
          : toIamIntegrationEvent(domainFact);
      expect(fact.version).toBe(version);
      expect(fact.aggregateId).toBe(userId);
      expect(fact.payload).toEqual({ userId });
      if (session) {
        expect(JSON.stringify(fact)).not.toContain(session.identifier.value);
      }

      const { audit, notifications, record, createForEvent, findUser } =
        consumers(userId);
      const incompatible = { ...fact, version: version === 2 ? 1 : 2 };
      await expect(audit.handle(incompatible)).rejects.toThrow("version");
      await expect(notifications.handle(incompatible)).rejects.toThrow(
        "version",
      );
      expect(record).not.toHaveBeenCalled();
      expect(findUser).not.toHaveBeenCalled();
      expect(createForEvent).not.toHaveBeenCalled();

      await audit.handle(fact);
      await notifications.handle(fact);
      expect(record).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          id: fact.eventId,
          type: fact.topic,
          context: expect.objectContaining({ subjectId: userId }),
        }),
      );
      expect(createForEvent).toHaveBeenCalledExactlyOnceWith(fact.eventId, [
        expect.objectContaining({
          recipientId: userId,
          sourceEventId: fact.eventId,
        }),
      ]);
    },
  );

  it("preserves the Audit-only subscription to the produced final erasure fact", async () => {
    const {
      audit,
      notifications,
      removeAccountReferences,
      record,
      createForEvent,
    } = consumers(UserEntity.create().identifier.value);
    const fact = createIamSecurityEvent({
      type: "account.deletion.executed",
      pseudonymousSubject: "synthetic-erasure-reference",
      eventId: randomUUID(),
      occurredAt: new Date(),
    });
    await audit.handle(fact);
    await notifications.handle(fact);
    expect(removeAccountReferences).toHaveBeenCalledExactlyOnceWith(
      "synthetic-erasure-reference",
    );
    expect(record).toHaveBeenCalledOnce();
    expect(createForEvent).not.toHaveBeenCalled();
  });
});
