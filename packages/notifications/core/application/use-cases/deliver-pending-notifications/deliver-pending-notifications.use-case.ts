import { Result } from "@architecture/foundation";

import type { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";

import { DeliverPendingNotificationsErrorCodes } from "./deliver-pending-notifications.codes.js";
import type {
  DeliverPendingNotifications,
  DeliverPendingNotificationsInput,
  DeliverPendingNotificationsOutput,
} from "./deliver-pending-notifications.contracts.js";

export class DeliverPendingNotificationsUseCase implements DeliverPendingNotifications {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly deliveries: readonly NotificationDelivery[],
  ) {}

  async execute(
    input: DeliverPendingNotificationsInput = {},
  ): Promise<DeliverPendingNotificationsOutput> {
    const limit = input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return Result.failure(DeliverPendingNotificationsErrorCodes.invalidLimit);
    }
    const notifications = await this.repository.claimDeliveries(limit);
    let deliveryCount = 0;
    for (const notification of notifications) {
      for (const delivery of notification.deliveries) {
        deliveryCount += 1;
        const adapter = this.deliveries.find(
          (candidate) => candidate.channel === delivery.channel.value,
        );
        try {
          if (!adapter) {
            throw new Error(`No adapter for ${delivery.channel.value}`);
          }
          await adapter.send(notification, delivery);
          delivery.markSent();
        } catch (error) {
          delivery.markFailed(error);
        }
        await this.repository.save(notification);
      }
    }
    return Result.success(deliveryCount);
  }
}
