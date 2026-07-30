import type { NotificationChannelType } from "@architecture/notifications/domain";

import type { PendingDelivery } from "#repositories/notification.repository";

export interface NotificationDelivery {
  readonly channel: NotificationChannelType;
  send(delivery: PendingDelivery): Promise<void>;
}
