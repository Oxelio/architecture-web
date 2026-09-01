import { describe, expect, it, vi } from "vitest";

import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "#domain/index";

import type { NotificationRepository } from "../../repositories/notification.repository.js";
import { MarkNotificationReadUseCase } from "./mark-notification-read.use-case.js";

describe("MarkNotificationReadUseCase", () => {
  it("returns a stable not-found code", async () => {
    const useCase = new MarkNotificationReadUseCase({
      findByIdForRecipient: vi.fn().mockResolvedValue(null),
    } as unknown as NotificationRepository);

    const result = await useCase.execute({
      actorUserId: "user-1",
      notificationId: "notification-1",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "notification.not_found" },
    });
  });

  it("is idempotent when the notification is already read", async () => {
    const severity = NotificationSeverityValueObject.create("information");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const notification = NotificationEntity.create({
      recipientId: "user-1",
      sourceEventId: "event-1",
      type: "iam.user-registered",
      severity: severity.value,
      title: "Account created",
      message: "Your account has been created.",
      deliveries: [],
    });
    notification.markRead();
    const save = vi.fn();
    const useCase = new MarkNotificationReadUseCase({
      findByIdForRecipient: vi.fn().mockResolvedValue(notification),
      save,
    } as unknown as NotificationRepository);

    const result = await useCase.execute({
      actorUserId: "user-1",
      notificationId: notification.identifier.value,
    });

    expect(result).toEqual({ success: true, value: undefined });
    expect(save).not.toHaveBeenCalled();
  });
});
