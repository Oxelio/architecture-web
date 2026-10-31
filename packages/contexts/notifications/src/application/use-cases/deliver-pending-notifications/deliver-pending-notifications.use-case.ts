import { Result } from "@architecture/foundation";

import type { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";

import type {
  DeliverPendingNotifications,
  DeliverPendingNotificationsInput,
  DeliverPendingNotificationsOutput,
} from "./deliver-pending-notifications.contracts.js";
import { DeliverPendingNotificationsErrors } from "./deliver-pending-notifications.contracts.js";

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
      return Result.failure(DeliverPendingNotificationsErrors.invalidLimit);
    }
    await this.repository.recoverStaleDeliveries();
    let deliveryCount = 0;
    while (deliveryCount < limit) {
      const claim = await this.repository.claimDelivery();
      if (!claim) {
        break;
      }
      const { notification, delivery } = claim;
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
      if (!(await this.repository.finalizeDelivery(claim))) {
        throw new Error("Notification delivery claim expired or replaced");
      }
    }
    return Result.success(deliveryCount);
  }
}
