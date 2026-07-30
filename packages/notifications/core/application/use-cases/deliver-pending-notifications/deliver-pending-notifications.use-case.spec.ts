import {
  NotificationEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import { describe, expect, it, vi } from "vitest";

import type { NotificationRepository } from "../../repositories/notification.repository.js";
import { DeliverPendingNotificationsUseCase } from "./deliver-pending-notifications.use-case.js";

function createClaimedNotification(): NotificationEntity {
  const severity = NotificationSeverityValueObject.create("warning");
  if (!severity.success) {
    throw new Error("Test fixture is invalid");
  }
  const now = new Date("2026-01-01T00:00:00.000Z");
  const notification = NotificationEntity.create(
    {
      recipientId: "user-1",
      sourceEventId: "event-1",
      type: "iam.session-started",
      severity: severity.value,
      title: "Security alert",
      message: "A new session was opened.",
      deliveries: [{ channel: "email", destination: "user@example.test" }],
    },
    now,
  );
  notification.deliveries[0]?.claim(now);
  return notification;
}

describe("DeliverPendingNotificationsUseCase", () => {
  it("applies the successful delivery transition before saving", async () => {
    const notification = createClaimedNotification();
    const save = vi.fn();
    const repository = {
      claimDeliveries: vi.fn().mockResolvedValue([notification]),
      save,
    } as unknown as NotificationRepository;
    const send = vi.fn().mockResolvedValue(undefined);
    const useCase = new DeliverPendingNotificationsUseCase(repository, [
      { channel: "email", send },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual({ success: true, value: 1 });
    expect(send).toHaveBeenCalledWith(notification, notification.deliveries[0]);
    expect(notification.deliveries[0]?.status).toBe("sent");
    expect(save).toHaveBeenCalledWith(notification);
  });

  it("applies retry policy in the domain after an adapter failure", async () => {
    const notification = createClaimedNotification();
    const repository = {
      claimDeliveries: vi.fn().mockResolvedValue([notification]),
      save: vi.fn(),
    } as unknown as NotificationRepository;
    const useCase = new DeliverPendingNotificationsUseCase(repository, [
      {
        channel: "email",
        send: vi.fn().mockRejectedValue(new Error("provider unavailable")),
      },
    ]);

    await useCase.execute();

    expect(notification.deliveries[0]?.status).toBe("failed");
    expect(notification.deliveries[0]?.attempts).toBe(1);
  });
});
