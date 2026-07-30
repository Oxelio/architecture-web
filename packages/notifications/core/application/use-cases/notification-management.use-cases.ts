import type { NotificationChannelType } from "@architecture/notifications/domain";

import { NotificationRepository } from "#repositories/notification.repository";

export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string, page: number, pageSize: number) {
    return this.repository.list(userId, page, pageSize);
  }
}

export class GetUnreadNotificationCountUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string) {
    return this.repository.unreadCount(userId);
  }
}

export class MarkNotificationReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(userId: string, notificationId: string): Promise<boolean> {
    const notification = await this.repository.findByIdForRecipient(
      notificationId,
      userId,
    );
    if (!notification) {
      return false;
    }
    if (!notification.markRead()) {
      return false;
    }
    await this.repository.save(notification);
    return true;
  }
}

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string) {
    return this.repository.markAllRead(userId);
  }
}

export class GetNotificationPreferencesUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string) {
    return this.repository.preferences(userId);
  }
}

export class UpdateNotificationPreferenceUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string, channel: NotificationChannelType, enabled: boolean) {
    return this.repository.setPreference(userId, channel, enabled);
  }
}
