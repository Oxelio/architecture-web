import { describe, expect, it, vi } from "vitest";

import {
  NotificationApplication,
  type NotificationRecipientDirectory,
  type NotificationRepository,
} from "./notifications.js";

describe("NotificationApplication", () => {
  it("creates one user notification from a password-change fact", async () => {
    const create = vi.fn();
    const repository = {
      create,
      isChannelEnabled: vi.fn().mockResolvedValue(true),
    } as unknown as NotificationRepository;
    const directory = {
      findUser: vi.fn().mockResolvedValue({
        userId: "user-1",
        email: "user@example.test",
      }),
      listAdministratorIds: vi.fn().mockResolvedValue([]),
    } as unknown as NotificationRecipientDirectory;
    const email = { channel: "email" as const, send: vi.fn() };
    const application = new NotificationApplication(repository, directory, [
      email,
    ]);

    await application.handle({
      eventId: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
      topic: "iam.user-password-changed",
      version: 1,
      aggregateId: "user-1",
      occurredAt: new Date(),
      payload: { userId: "user-1" },
      context: { subjectId: "user-1" },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        sourceEventId: "018f4d10-85d8-7c1c-9c04-f2724d9c6b61",
        severity: "critical",
        deliveries: [{ channel: "email", destination: "user@example.test" }],
      }),
    );
  });
});
