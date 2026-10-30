import type {
  NotificationDeliveryEntity,
  NotificationEntity,
} from "#domain/index";

export interface ClaimedNotificationDelivery {
  readonly notification: NotificationEntity;
  readonly delivery: NotificationDeliveryEntity;
  readonly claimToken: string;
}

export abstract class NotificationRepository {
  abstract create(notification: NotificationEntity): Promise<void>;
  abstract findByIdForRecipient(
    notificationId: string,
    recipientId: string,
  ): Promise<NotificationEntity | null>;
  abstract saveState(notification: NotificationEntity): Promise<void>;
  abstract list(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<NotificationEntity[]>;
  abstract unreadCount(recipientId: string): Promise<number>;
  abstract markAllRead(recipientId: string): Promise<void>;
  abstract claimDelivery(): Promise<ClaimedNotificationDelivery | null>;
  abstract recoverStaleDeliveries(): Promise<void>;
  abstract finalizeDelivery(
    claim: ClaimedNotificationDelivery,
  ): Promise<boolean>;
}
