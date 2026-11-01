import type { IntegrationEventHandler } from "@architecture/messaging/application";

import type { DeliverPendingNotifications } from "#application/use-cases/deliver-pending-notifications/deliver-pending-notifications.contracts";
import { DeliverPendingNotificationsUseCase } from "#application/use-cases/deliver-pending-notifications/deliver-pending-notifications.use-case";
import type { GetNotificationPreferences } from "#application/use-cases/get-notification-preferences/get-notification-preferences.contracts";
import { GetNotificationPreferencesUseCase } from "#application/use-cases/get-notification-preferences/get-notification-preferences.use-case";
import type { GetUnreadNotificationCount } from "#application/use-cases/get-unread-notification-count/get-unread-notification-count.contracts";
import { GetUnreadNotificationCountUseCase } from "#application/use-cases/get-unread-notification-count/get-unread-notification-count.use-case";
import type { ListNotifications } from "#application/use-cases/list-notifications/list-notifications.contracts";
import { ListNotificationsUseCase } from "#application/use-cases/list-notifications/list-notifications.use-case";
import type { MarkAllNotificationsRead } from "#application/use-cases/mark-all-notifications-read/mark-all-notifications-read.contracts";
import { MarkAllNotificationsReadUseCase } from "#application/use-cases/mark-all-notifications-read/mark-all-notifications-read.use-case";
import type { MarkNotificationRead } from "#application/use-cases/mark-notification-read/mark-notification-read.contracts";
import { MarkNotificationReadUseCase } from "#application/use-cases/mark-notification-read/mark-notification-read.use-case";
import type { UpdateNotificationPreference } from "#application/use-cases/update-notification-preference/update-notification-preference.contracts";
import { UpdateNotificationPreferenceUseCase } from "#application/use-cases/update-notification-preference/update-notification-preference.use-case";
import type { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationPreferenceRepository } from "#repositories/notification-preference.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";
import type { NotificationRecipientDirectory } from "#services/notification-recipient-directory.service";
import { NotificationEventHandlerUseCase } from "#use-cases/notification-event-handler.use-case";

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
