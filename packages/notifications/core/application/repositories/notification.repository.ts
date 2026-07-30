import type {
  NotificationChannelType,
  NotificationEntity,
  NotificationSeverity,
} from "@architecture/notifications/domain";

export interface NotificationView {
  readonly id: string;
  readonly type: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
  readonly readAt: Date | null;
}

export interface NotificationPreference {
  readonly channel: NotificationChannelType;
  readonly enabled: boolean;
}

export interface PendingDelivery {
  readonly id: string;
  readonly notificationId: string;
  readonly channel: NotificationChannelType;
  readonly destination: string;
  readonly title: string;
  readonly message: string;
  readonly attempts: number;
}

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
  ): Promise<NotificationView[]>;
  abstract unreadCount(recipientId: string): Promise<number>;
  abstract markAllRead(recipientId: string): Promise<void>;
  abstract preferences(recipientId: string): Promise<NotificationPreference[]>;
  abstract setPreference(
    recipientId: string,
    channel: NotificationChannelType,
    enabled: boolean,
  ): Promise<void>;
  abstract isChannelEnabled(
    recipientId: string,
    channel: NotificationChannelType,
  ): Promise<boolean>;
  abstract claimDeliveries(limit: number): Promise<PendingDelivery[]>;
  abstract deliverySucceeded(id: string): Promise<void>;
  abstract deliveryFailed(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void>;
}
