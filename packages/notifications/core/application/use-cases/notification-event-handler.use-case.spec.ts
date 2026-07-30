import {
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

import type { NotificationRepository } from "../repositories/notification.repository.js";
import type { NotificationPreferenceRepository } from "../repositories/notification-preference.repository.js";
import type { NotificationRecipientDirectory } from "../services/notification-recipient-directory.service.js";
import { NotificationEventHandlerUseCase } from "./notification-event-handler.use-case.js";

describe("NotificationEventHandlerUseCase", () => {
  it("creates one user notification from a password-change fact", async () => {
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
      topic: "iam.user-password-changed",
      version: 1,
      aggregateId: "user-1",
      occurredAt: new Date(),
      payload: { userId: "user-1" },
      context: { subjectId: "user-1" },
    });

    expect(create).toHaveBeenCalledOnce();
    const notification = create.mock.calls[0]?.[0];
    expect(notification.recipientId).toBe("user-1");
    expect(notification.severity.value).toBe("critical");
    expect(notification.deliveries[0]?.destination).toBe("user@example.test");
  });
});
