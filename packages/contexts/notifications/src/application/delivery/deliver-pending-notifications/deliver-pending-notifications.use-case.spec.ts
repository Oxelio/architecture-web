import { describe, expect, it, vi } from "vitest";

import {
  type NotificationDeliveryAudience,
  NotificationEntity,
  NotificationSeverityValueObject,
} from "#domain/index";

import type { NotificationRepository } from "../../repositories/notification.repository.js";
import { DeliverPendingNotificationsUseCase } from "./deliver-pending-notifications.use-case.js";

const directory = {
  findUser: vi.fn(),
  listAdministratorIds: vi.fn(),
  isActiveAdministrator: vi.fn().mockResolvedValue(true),
};

function createClaimedNotification(
  audience: NotificationDeliveryAudience = "affected_user",
): NotificationEntity {
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
      deliveries: [
        { channel: "email", destination: "user@example.test", audience },
      ],
    },
    now,
  );
  notification.deliveries[0]?.claim(now);
  return notification;
}

describe("DeliverPendingNotificationsUseCase", () => {
  it.each(["affected_user", "affected_user_and_administrator"] as const)(
    "preserves the %s basis without an administrative lookup",
    async (audience) => {
      const notification = createClaimedNotification(audience);
      const isActiveAdministrator = vi
        .fn()
        .mockRejectedValue(new Error("unavailable"));
      const send = vi.fn();
      const repository = {
        recoverStaleDeliveries: vi.fn(),
        claimDelivery: vi
          .fn()
          .mockResolvedValueOnce({
            notification,
            delivery: notification.deliveries[0],
            claimToken: "owner",
          })
          .mockResolvedValue(null),
        finalizeDelivery: vi.fn().mockResolvedValue(true),
      };
      await new DeliverPendingNotificationsUseCase(
        repository as never,
        [{ channel: "email", send }],
        { ...directory, isActiveAdministrator },
      ).execute();
      expect(isActiveAdministrator).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledOnce();
      expect(notification.deliveries[0]?.status).toBe("sent");
    },
  );

  it.each(["denied", "unavailable", "authorized"] as const)(
    "handles administrative authorization %s without changing the snapshot",
    async (outcome) => {
      const notification = createClaimedNotification("administrator");
      notification.markRead(new Date("2026-01-02"));
      const readAt = notification.readAt;
      const isActiveAdministrator = vi.fn();
      if (outcome === "unavailable") {
        isActiveAdministrator.mockRejectedValue(
          new Error("directory unavailable"),
        );
      } else {
        isActiveAdministrator.mockResolvedValue(outcome === "authorized");
      }
      const send = vi.fn();
      const finalizeDelivery = vi.fn().mockResolvedValue(true);
      const repository = {
        recoverStaleDeliveries: vi.fn(),
        claimDelivery: vi
          .fn()
          .mockResolvedValueOnce({
            notification,
            delivery: notification.deliveries[0],
            claimToken: "owner",
          })
          .mockResolvedValue(null),
        finalizeDelivery,
      };
      await new DeliverPendingNotificationsUseCase(
        repository as never,
        [{ channel: "email", send }],
        { ...directory, isActiveAdministrator },
      ).execute();
      expect(isActiveAdministrator).toHaveBeenCalledWith("user-1");
      expect(send).toHaveBeenCalledTimes(outcome === "authorized" ? 1 : 0);
      const delivery = notification.deliveries[0];
      expect(delivery?.status).toBe(
        outcome === "denied"
          ? "suppressed"
          : outcome === "unavailable"
            ? "failed"
            : "sent",
      );
      expect(delivery?.suppressionReason).toBe(
        outcome === "denied" ? "administrator_not_authorized" : null,
      );
      expect(delivery?.destination).toBe("user@example.test");
      expect(notification.readAt).toBe(readAt);
      expect(finalizeDelivery).toHaveBeenCalledOnce();
    },
  );
  it("reports a lost claim without attempting another item in that run", async () => {
    const notification = createClaimedNotification();
    const claimDelivery = vi.fn().mockResolvedValue({
      notification,
      delivery: notification.deliveries[0],
      claimToken: "lost",
    });
    const useCase = new DeliverPendingNotificationsUseCase(
      {
        claimDelivery,
        recoverStaleDeliveries: vi.fn(),
        finalizeDelivery: vi.fn().mockResolvedValue(false),
      } as never,
      [{ channel: "email", send: vi.fn() }],
      directory,
    );
    await expect(useCase.execute()).rejects.toThrow(
      "claim expired or replaced",
    );
    expect(claimDelivery).toHaveBeenCalledOnce();
  });
  it("continues to the next claimed channel after a provider failure", async () => {
    const first = createClaimedNotification(),
      second = createClaimedNotification();
    const claimDelivery = vi
      .fn()
      .mockResolvedValueOnce({
        notification: first,
        delivery: first.deliveries[0],
        claimToken: "one",
      })
      .mockResolvedValueOnce({
        notification: second,
        delivery: second.deliveries[0],
        claimToken: "two",
      })
      .mockResolvedValue(null);
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("first provider failure"))
      .mockResolvedValue(undefined);
    const useCase = new DeliverPendingNotificationsUseCase(
      {
        claimDelivery,
        recoverStaleDeliveries: vi.fn(),
        finalizeDelivery: vi.fn().mockResolvedValue(true),
      } as never,
      [{ channel: "email", send }],
      directory,
    );
    expect(await useCase.execute()).toEqual({ success: true, value: 2 });
    expect(first.deliveries[0]?.status).toBe("failed");
    expect(second.deliveries[0]?.status).toBe("sent");
  });
  it("applies the successful delivery transition before saving", async () => {
    const notification = createClaimedNotification();
    const save = vi.fn().mockResolvedValue(true);
    const repository = {
      claimDelivery: vi
        .fn()
        .mockResolvedValueOnce({
          notification,
          delivery: notification.deliveries[0],
          claimToken: "claim-1",
        })
        .mockResolvedValue(null),
      recoverStaleDeliveries: vi.fn(),
      finalizeDelivery: save,
    } as unknown as NotificationRepository;
    const send = vi.fn().mockResolvedValue(undefined);
    const useCase = new DeliverPendingNotificationsUseCase(
      repository,
      [{ channel: "email", send }],
      directory,
    );

    const result = await useCase.execute();

    expect(result).toEqual({ success: true, value: 1 });
    expect(send).toHaveBeenCalledWith(notification, notification.deliveries[0]);
    expect(notification.deliveries[0]?.status).toBe("sent");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ notification, claimToken: "claim-1" }),
    );
  });

  it("applies retry policy in the domain after an adapter failure", async () => {
    const notification = createClaimedNotification();
    const repository = {
      claimDelivery: vi
        .fn()
        .mockResolvedValueOnce({
          notification,
          delivery: notification.deliveries[0],
          claimToken: "claim-1",
        })
        .mockResolvedValue(null),
      recoverStaleDeliveries: vi.fn(),
      finalizeDelivery: vi.fn().mockResolvedValue(true),
    } as unknown as NotificationRepository;
    const useCase = new DeliverPendingNotificationsUseCase(
      repository,
      [
        {
          channel: "email",
          send: vi.fn().mockRejectedValue(new Error("provider unavailable")),
        },
      ],
      directory,
    );

    await useCase.execute();

    expect(notification.deliveries[0]?.status).toBe("failed");
    expect(notification.deliveries[0]?.attempts).toBe(1);
  });
});
