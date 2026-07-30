import type { NotificationEntity } from "@architecture/notifications/domain";

export abstract class NotificationRepository {
  abstract create(notification: NotificationEntity): Promise<void>;
  abstract findByIdForRecipient(
    notificationId: string,
    recipientId: string,
  ): Promise<NotificationEntity | null>;
  abstract save(notification: NotificationEntity): Promise<void>;
  abstract list(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationEntity[]>;
  abstract unreadCount(recipientId: string): Promise<number>;
  abstract markAllRead(recipientId: string): Promise<void>;
  abstract claimDeliveries(limit: number): Promise<NotificationEntity[]>;
}
