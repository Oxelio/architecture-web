import type {
  NotificationChannelType,
  NotificationDeliveryEntity,
  NotificationEntity,
} from "@architecture/notifications/domain";

export abstract class NotificationDelivery {
  abstract readonly channel: NotificationChannelType;
  abstract send(
    notification: NotificationEntity,
    delivery: NotificationDeliveryEntity,
  ): Promise<void>;
}
