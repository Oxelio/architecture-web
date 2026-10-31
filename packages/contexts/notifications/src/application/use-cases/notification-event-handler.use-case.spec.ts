import { describe, expect, it, vi } from "vitest";

import {
  type NotificationEntity,
  NotificationRecipientEntity,
  NotificationRecipientIdentifierValueObject,
} from "#domain/index";

import type { NotificationRepository } from "../repositories/notification.repository.js";
import type { NotificationPreferenceRepository } from "../repositories/notification-preference.repository.js";
import type { NotificationRecipientDirectory } from "../services/notification-recipient-directory.service.js";
import { NotificationEventHandlerUseCase } from "./notification-event-handler.use-case.js";

function fixture(topic = "security.suspicious-activity-detected") {
  const fact = {
    eventId: "event-1",
    topic,
    version: 1,
    aggregateId: "user-1",
    occurredAt: new Date(),
    payload: { userId: "user-1" },
    context: {},
  };
  const repository = {
    hasConsumedEvent: vi.fn().mockResolvedValue(false),
    createForEvent: vi
      .fn<
        (
          sourceEventId: string,
          notifications: readonly NotificationEntity[],
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined),
  };
  const directory = {
    listAdministratorIds: vi
      .fn()
      .mockResolvedValue(["user-1", "admin-1", "admin-1"]),
    findUser: vi.fn(
      async (userId: string): Promise<NotificationRecipientEntity | null> => {
        const identifier =
          NotificationRecipientIdentifierValueObject.create(userId);
        if (!identifier.success) {
          throw new Error("Invalid fixture");
        }
        return NotificationRecipientEntity.create({
          identifier: identifier.value,
          email: `${userId}@example.test`,
          phoneNumber: "test-phone",
        });
      },
    ),
  };
  const preferences = { find: vi.fn().mockResolvedValue(null) };
  const handler = new NotificationEventHandlerUseCase(
    repository as unknown as NotificationRepository,
    preferences as unknown as NotificationPreferenceRepository,
    directory,
    (["email", "sms", "slack"] as const).map((channel) => ({
      channel,
      send: vi.fn(),
    })),
  );
  return { fact, repository, directory, preferences, handler };
}

describe("NotificationEventHandlerUseCase", () => {
  it("resolves each recipient once and composes all user/admin channels before persistence", async () => {
    const { handler, fact, repository, directory } = fixture();
    await handler.handle(fact);
    expect(directory.findUser.mock.calls.map(([id]) => id)).toEqual([
      "user-1",
      "admin-1",
    ]);
    expect(repository.createForEvent).toHaveBeenCalledOnce();
    const notifications = repository.createForEvent.mock.calls[0]?.[1];
    expect(notifications).toHaveLength(2);
    expect(
      notifications?.[0]?.deliveries.map((delivery) => delivery.channel.value),
    ).toEqual(["email", "sms", "slack"]);
    expect(
      notifications?.[1]?.deliveries.map((delivery) => delivery.channel.value),
    ).toEqual(["slack"]);
    expect(notifications?.[0]?.deliveries[2]?.destination).toBe("security");
  });

  it("does not consult mutable recipient state for an already-consumed supported fact", async () => {
    const { handler, fact, repository, directory, preferences } = fixture();
    repository.hasConsumedEvent.mockResolvedValue(true);
    await handler.handle(fact);
    expect(repository.hasConsumedEvent).toHaveBeenCalledWith(fact.eventId);
    expect(directory.findUser).not.toHaveBeenCalled();
    expect(directory.listAdministratorIds).not.toHaveBeenCalled();
    expect(preferences.find).not.toHaveBeenCalled();
    expect(repository.createForEvent).not.toHaveBeenCalled();
    await expect(handler.handle({ ...fact, version: 999 })).rejects.toThrow(
      "version",
    );
  });

  it("persists an empty selection when no recipient exists", async () => {
    const { handler, fact, repository, directory } = fixture();
    directory.findUser.mockResolvedValue(null);
    await handler.handle(fact);
    expect(repository.createForEvent).toHaveBeenCalledWith(fact.eventId, []);
  });

  it.each([true, false])(
    "honors optional preferences while mandatory=%s",
    async (mandatory) => {
      const { handler, fact, repository, preferences } = fixture(
        mandatory ? "iam.user-password-changed" : "iam.user-registered",
      );
      preferences.find.mockResolvedValue({ enabled: false });
      await handler.handle(fact);
      expect(
        repository.createForEvent.mock.calls[0]?.[1]?.[0]?.deliveries,
      ).toHaveLength(mandatory ? 1 : 0);
    },
  );

  it.each([
    "consumption",
    "administrator list",
    "recipient",
    "preference",
    "persistence",
  ])(
    "propagates a %s failure instead of acknowledging partial processing",
    async (stage) => {
      const { handler, fact, repository, directory, preferences } = fixture(
        "iam.user-role-changed",
      );
      const failure = new Error("temporary technical failure");
      if (stage === "consumption") {
        repository.hasConsumedEvent.mockRejectedValueOnce(failure);
      }
      if (stage === "administrator list") {
        directory.listAdministratorIds.mockRejectedValueOnce(failure);
      }
      if (stage === "recipient") {
        directory.findUser
          .mockResolvedValueOnce(await directory.findUser("user-1"))
          .mockRejectedValueOnce(failure);
      }
      if (stage === "preference") {
        fact.topic = "iam.user-registered";
        preferences.find.mockRejectedValueOnce(failure);
      }
      if (stage === "persistence") {
        repository.createForEvent.mockRejectedValueOnce(failure);
      }
      await expect(handler.handle(fact)).rejects.toBe(failure);
      expect(repository.createForEvent).toHaveBeenCalledTimes(
        stage === "persistence" ? 1 : 0,
      );
    },
  );
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
      const createForEvent = vi.fn();
      const repository = {
        createForEvent,
        hasConsumedEvent: vi.fn().mockResolvedValue(false),
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

      expect(createForEvent).toHaveBeenCalledOnce();
      const notification = createForEvent.mock.calls[0]?.[1]?.[0];
      expect(notification.recipientId).toBe("user-1");
      expect(notification.severity.value).toBe(severity);
      expect(notification.deliveries[0]?.destination).toBe("user@example.test");
    },
  );
});
