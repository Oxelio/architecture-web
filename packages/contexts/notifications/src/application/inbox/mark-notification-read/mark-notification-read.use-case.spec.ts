import { describe, expect, it, vi } from "vitest";

import type { NotificationRepository } from "../../repositories/notification.repository.js";
import { MarkNotificationReadUseCase } from "./mark-notification-read.use-case.js";

describe("MarkNotificationReadUseCase", () => {
  it("returns a stable not-found code", async () => {
    const useCase = new MarkNotificationReadUseCase({
      markReadForRecipient: vi.fn().mockResolvedValue(false),
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

  it("passes the notification and recipient to atomic acknowledgement", async () => {
    const markReadForRecipient = vi.fn().mockResolvedValue(true);
    const useCase = new MarkNotificationReadUseCase({
      markReadForRecipient,
    } as unknown as NotificationRepository);

    const result = await useCase.execute({
      actorUserId: "user-1",
      notificationId: "notification-1",
    });

    expect(result).toEqual({ success: true, value: undefined });
    expect(markReadForRecipient).toHaveBeenCalledExactlyOnceWith(
      "notification-1",
      "user-1",
    );
  });
});
