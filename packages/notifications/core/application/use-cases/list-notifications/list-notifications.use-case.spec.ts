import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

import type { NotificationRepository } from "../../repositories/notification.repository.js";
import { ListNotificationsUseCase } from "./list-notifications.use-case.js";

describe("ListNotificationsUseCase", () => {
  it("validates pagination before calling the repository", async () => {
    const list = vi.fn();
    const useCase = new ListNotificationsUseCase({
      list,
    } as unknown as NotificationRepository);

    const result = await useCase.execute({
      actorUserId: "user-1",
      pageSize: 101,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "notifications.invalid_page_size" },
    });
    expect(list).not.toHaveBeenCalled();
  });

  it("maps domain entities to the output contract", async () => {
    const severity = NotificationSeverityValueObject.create("information");
    if (!severity.success) {
      throw new Error("Test fixture is invalid");
    }
    const notification = NotificationEntity.create(
      {
        recipientId: "user-1",
        sourceEventId: "event-1",
        type: "iam.user-registered",
        severity: severity.value,
        title: "Account created",
        message: "Your account has been created.",
        deliveries: [],
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const useCase = new ListNotificationsUseCase({
      list: vi.fn().mockResolvedValue([notification]),
    } as unknown as NotificationRepository);

    const result = await useCase.execute({ actorUserId: "user-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value[0]).toMatchObject({
        id: notification.identifier.value,
        severity: "information",
        title: "Account created",
      });
    }
  });
});
