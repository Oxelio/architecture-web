import { describe, expect, it, vi } from "vitest";

import type { NotificationPreferenceRepository } from "../../repositories/notification-preference.repository.js";
import { UpdateNotificationPreferenceUseCase } from "./update-notification-preference.use-case.js";

describe("UpdateNotificationPreferenceUseCase", () => {
  it("creates and saves a domain entity for a new preference", async () => {
    const save = vi.fn();
    const useCase = new UpdateNotificationPreferenceUseCase({
      find: vi.fn().mockResolvedValue(null),
      save,
    } as unknown as NotificationPreferenceRepository);

    const result = await useCase.execute({
      actorUserId: "user-1",
      channel: "email",
      enabled: false,
    });

    expect(result).toEqual({ success: true, value: undefined });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      recipientId: "user-1",
      enabled: false,
    });
  });
});
