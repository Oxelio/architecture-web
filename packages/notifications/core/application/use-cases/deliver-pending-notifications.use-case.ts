import { NotificationRepository } from "#repositories/notification.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";

export class DeliverPendingNotificationsUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly deliveries: readonly NotificationDelivery[],
  ) {}

  async execute(limit = 50): Promise<number> {
    const pending = await this.repository.claimDeliveries(limit);
    for (const delivery of pending) {
      const adapter = this.deliveries.find(
        (candidate) => candidate.channel === delivery.channel,
      );
      try {
        if (!adapter) {
          throw new Error(`No adapter for ${delivery.channel}`);
        }
        await adapter.send(delivery);
        await this.repository.deliverySucceeded(delivery.id);
      } catch (error) {
        await this.repository.deliveryFailed(
          delivery.id,
          delivery.attempts + 1,
          error,
        );
      }
    }
    return pending.length;
  }
}
