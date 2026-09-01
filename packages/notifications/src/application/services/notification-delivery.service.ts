import type {
  NotificationChannelType,
  NotificationDeliveryEntity,
  NotificationEntity,
} from "#domain/index";

export abstract class NotificationDelivery {
  abstract readonly channel: NotificationChannelType;
  abstract send(
    notification: NotificationEntity,
    delivery: NotificationDeliveryEntity,
  ): Promise<void>;
}
