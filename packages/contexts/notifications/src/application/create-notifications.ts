import type { IntegrationEventHandler } from "@architecture/messaging/application";

import type { DeliverPendingNotifications } from "#application/delivery/deliver-pending-notifications/deliver-pending-notifications.contracts";
import { DeliverPendingNotificationsUseCase } from "#application/delivery/deliver-pending-notifications/deliver-pending-notifications.use-case";
import type { GetUnreadNotificationCount } from "#application/inbox/get-unread-notification-count/get-unread-notification-count.contracts";
import { GetUnreadNotificationCountUseCase } from "#application/inbox/get-unread-notification-count/get-unread-notification-count.use-case";
import type { ListNotifications } from "#application/inbox/list-notifications/list-notifications.contracts";
import { ListNotificationsUseCase } from "#application/inbox/list-notifications/list-notifications.use-case";
import type { MarkAllNotificationsRead } from "#application/inbox/mark-all-notifications-read/mark-all-notifications-read.contracts";
import { MarkAllNotificationsReadUseCase } from "#application/inbox/mark-all-notifications-read/mark-all-notifications-read.use-case";
import type { MarkNotificationRead } from "#application/inbox/mark-notification-read/mark-notification-read.contracts";
import { MarkNotificationReadUseCase } from "#application/inbox/mark-notification-read/mark-notification-read.use-case";
import { NotificationEventHandlerUseCase } from "#application/intake/notification-event-handler.use-case";
import type { NotificationDelivery } from "#application/ports/notification-delivery.port";
import type { NotificationRecipientDirectory } from "#application/ports/notification-recipient-directory.port";
import type { GetNotificationPreferences } from "#application/preferences/get-notification-preferences/get-notification-preferences.contracts";
import { GetNotificationPreferencesUseCase } from "#application/preferences/get-notification-preferences/get-notification-preferences.use-case";
import type { UpdateNotificationPreference } from "#application/preferences/update-notification-preference/update-notification-preference.contracts";
import { UpdateNotificationPreferenceUseCase } from "#application/preferences/update-notification-preference/update-notification-preference.use-case";
import type { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationPreferenceRepository } from "#repositories/notification-preference.repository";

export interface NotificationsDependencies {
  readonly notificationRepository: NotificationRepository;
  readonly preferenceRepository: NotificationPreferenceRepository;
  readonly recipientDirectory: NotificationRecipientDirectory;
  readonly deliveries?: readonly NotificationDelivery[];
}

export interface NotificationsApplication {
  readonly integrationEventHandler: IntegrationEventHandler;
  readonly listNotifications: ListNotifications;
  readonly unreadCount: GetUnreadNotificationCount;
  readonly markRead: MarkNotificationRead;
  readonly markAllRead: MarkAllNotificationsRead;
  readonly getPreferences: GetNotificationPreferences;
  readonly updatePreference: UpdateNotificationPreference;
  readonly deliverPending: DeliverPendingNotifications;
}

export function createNotifications(
  dependencies: NotificationsDependencies,
): NotificationsApplication {
  const deliveries = dependencies.deliveries ?? [];
  return {
    integrationEventHandler: new NotificationEventHandlerUseCase(
      dependencies.notificationRepository,
      dependencies.preferenceRepository,
      dependencies.recipientDirectory,
      deliveries,
    ),
    listNotifications: new ListNotificationsUseCase(
      dependencies.notificationRepository,
    ),
    unreadCount: new GetUnreadNotificationCountUseCase(
      dependencies.notificationRepository,
    ),
    markRead: new MarkNotificationReadUseCase(
      dependencies.notificationRepository,
    ),
    markAllRead: new MarkAllNotificationsReadUseCase(
      dependencies.notificationRepository,
    ),
    getPreferences: new GetNotificationPreferencesUseCase(
      dependencies.preferenceRepository,
    ),
    updatePreference: new UpdateNotificationPreferenceUseCase(
      dependencies.preferenceRepository,
    ),
    deliverPending: new DeliverPendingNotificationsUseCase(
      dependencies.notificationRepository,
      deliveries,
      dependencies.recipientDirectory,
    ),
  };
}
