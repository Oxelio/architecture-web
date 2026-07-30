import type { IntegrationEventHandler } from "@architecture/messaging/application";
import type { NotificationChannelType } from "@architecture/notifications/domain";

import type {
  NotificationPreference,
  NotificationRepository,
  NotificationView,
} from "#repositories/notification.repository";
import type { NotificationRecipientDirectory } from "#repositories/notification-recipient-directory.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";
import { DeliverPendingNotificationsUseCase } from "#use-cases/deliver-pending-notifications.use-case";
import { NotificationEventHandlerUseCase } from "#use-cases/notification-event-handler.use-case";
import {
  GetNotificationPreferencesUseCase,
  GetUnreadNotificationCountUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  UpdateNotificationPreferenceUseCase,
} from "#use-cases/notification-management.use-cases";

export interface NotificationsDependencies {
  readonly repository: NotificationRepository;
  readonly recipientDirectory: NotificationRecipientDirectory;
  readonly deliveries?: readonly NotificationDelivery[];
}

export interface NotificationsApplication {
  readonly integrationEventHandler: IntegrationEventHandler;
  readonly listNotifications: {
    execute(
      userId: string,
      page: number,
      pageSize: number,
    ): Promise<NotificationView[]>;
  };
  readonly unreadCount: {
    execute(userId: string): Promise<number>;
  };
  readonly markRead: {
    execute(userId: string, notificationId: string): Promise<boolean>;
  };
  readonly markAllRead: {
    execute(userId: string): Promise<void>;
  };
  readonly getPreferences: {
    execute(userId: string): Promise<NotificationPreference[]>;
  };
  readonly updatePreference: {
    execute(
      userId: string,
      channel: NotificationChannelType,
      enabled: boolean,
    ): Promise<void>;
  };
  readonly deliverPending: {
    execute(limit?: number): Promise<number>;
  };
}

export function createNotifications(
  dependencies: NotificationsDependencies,
): NotificationsApplication {
  const deliveries = dependencies.deliveries ?? [];
  return {
    integrationEventHandler: new NotificationEventHandlerUseCase(
      dependencies.repository,
      dependencies.recipientDirectory,
      deliveries,
    ),
    listNotifications: new ListNotificationsUseCase(dependencies.repository),
    unreadCount: new GetUnreadNotificationCountUseCase(dependencies.repository),
    markRead: new MarkNotificationReadUseCase(dependencies.repository),
    markAllRead: new MarkAllNotificationsReadUseCase(dependencies.repository),
    getPreferences: new GetNotificationPreferencesUseCase(
      dependencies.repository,
    ),
    updatePreference: new UpdateNotificationPreferenceUseCase(
      dependencies.repository,
    ),
    deliverPending: new DeliverPendingNotificationsUseCase(
      dependencies.repository,
      deliveries,
    ),
  };
}
