import { describe, expect, it, vi } from "vitest";

import {
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "#domain/index";

import type { NotificationRepository } from "../repositories/notification.repository.js";
import type { NotificationPreferenceRepository } from "../repositories/notification-preference.repository.js";
import type { NotificationRecipientDirectory } from "../services/notification-recipient-directory.service.js";
import { NotificationEventHandlerUseCase } from "./notification-event-handler.use-case.js";

describe("NotificationEventHandlerUseCase", () => {
  it.each([
    ["iam.session-started", 1],
    ["iam.session-started", 999],
    ["iam.user-password-changed", 2],
  ])("rejects unsupported %s v%s before any effect", async (topic, version) => {
    const findUser = vi.fn();
    const handler = new NotificationEventHandlerUseCase(
      {} as never,
      {} as never,
      { findUser } as never,
      [],
    );
    await expect(
      handler.handle({
        eventId: "event",
        topic,
        version,
        aggregateId: "account",
        occurredAt: new Date(),
        payload: { userId: "account" },
        context: {},
      }),
    ).rejects.toThrow("version");
    expect(findUser).not.toHaveBeenCalled();
  });
  it("rejects malformed current facts rather than acknowledging them silently", async () => {
    const handler = new NotificationEventHandlerUseCase(
      {} as never,
      {} as never,
      {} as never,
      [],
    );
    await expect(
      handler.handle({
        eventId: "event",
        topic: "iam.session-started",
        version: 2,
        aggregateId: "account",
        occurredAt: new Date(),
        payload: {},
        context: {},
      }),
    ).rejects.toThrow("subject");
  });
  it.each([
    ["iam.user-password-changed", 1, "critical"],
    ["iam.session-started", 2, "warning"],
  ] as const)(
    "creates one user notification from current %s v%s",
    async (topic, version, severity) => {
      const create = vi.fn();
      const repository = {
        create,
      } as unknown as NotificationRepository;
      const preferences = {
        find: vi.fn().mockResolvedValue(null),
      } as unknown as NotificationPreferenceRepository;
      const identifier =
        NotificationRecipientIdentifierValueObject.create("user-1");
      if (!identifier.success) {
        throw new Error("Test fixture is invalid");
      }
      const directory = {
        findUser: vi.fn().mockResolvedValue(
          NotificationRecipientEntity.create({
            identifier: identifier.value,
            email: "user@example.test",
            phoneNumber: null,
          }),
        ),
        listAdministratorIds: vi.fn().mockResolvedValue([]),
      } as unknown as NotificationRecipientDirectory;
      const useCase = new NotificationEventHandlerUseCase(
        repository,
        preferences,
        directory,
        [{ channel: "email", send: vi.fn() }],
      );

      await useCase.handle({
        eventId: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
        topic,
        version,
        aggregateId: "user-1",
        occurredAt: new Date(),
        payload: { userId: "user-1" },
        context: { subjectId: "user-1" },
      });

      expect(create).toHaveBeenCalledOnce();
      const notification = create.mock.calls[0]?.[0];
      expect(notification.recipientId).toBe("user-1");
      expect(notification.severity.value).toBe(severity);
      expect(notification.deliveries[0]?.destination).toBe("user@example.test");
    },
  );
});
