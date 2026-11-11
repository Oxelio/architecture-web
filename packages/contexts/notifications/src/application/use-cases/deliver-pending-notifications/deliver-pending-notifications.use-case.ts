import { Result } from "@architecture/foundation";

import type {
  ClaimedNotificationDelivery,
  DeliveryEligibilityClaim,
  NotificationRepository,
} from "#repositories/notification.repository";
import type { NotificationDelivery } from "#services/notification-delivery.service";
import type { NotificationRecipientDirectory } from "#services/notification-recipient-directory.service";

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
    private readonly directory: NotificationRecipientDirectory,
    private readonly dataUseDeadline?: Date,
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
      const reservation = await this.repository.claimDelivery();
      if (!reservation) {
        break;
      }
      deliveryCount += 1;
      const claim =
        "recipientId" in reservation
          ? await this.authorizeAffectedUserDelivery(reservation)
          : reservation;
      if (claim) {
        await this.deliver(claim);
      }
    }
    return Result.success(deliveryCount);
  }

  private async authorizeAffectedUserDelivery(
    claim: DeliveryEligibilityClaim,
  ): Promise<ClaimedNotificationDelivery | null> {
    const eligibility = await this.directory
      .readAffectedUserDeliveryEligibility(claim.recipientId)
      .catch(() => "unresolved" as const);
    return this.repository.resolveDeliveryEligibility(
      claim,
      eligibility,
      this.dataUseDeadline,
    );
  }

  private async deliver(claim: ClaimedNotificationDelivery): Promise<void> {
    const { notification, delivery } = claim;
    if (delivery.audience === "administrator") {
      await this.checkAdministrator(claim);
    } else {
      if (!(await this.repository.ownsAuthorizedDelivery(claim))) {
        return;
      }
      if (
        this.dataUseDeadline &&
        Date.now() >= this.dataUseDeadline.getTime()
      ) {
        await this.repository.expireDeliveryAuthorization(claim);
        return;
      }
    }

    if (delivery.status === "processing") {
      const adapter = this.deliveries.find(
        (candidate) => candidate.channel === delivery.channel.value,
      );
      if (!adapter) {
        delivery.markFailed("delivery_adapter_unavailable");
      } else {
        try {
          await adapter.send(notification, delivery);
          delivery.markSent();
        } catch {
          delivery.markFailed("provider_outcome_unknown");
        }
      }
    }
    if (!(await this.repository.finalizeDelivery(claim))) {
      throw new Error("Notification delivery claim expired or replaced");
    }
  }

  private async checkAdministrator({
    notification,
    delivery,
  }: ClaimedNotificationDelivery): Promise<void> {
    try {
      if (
        !(await this.directory.isActiveAdministrator(notification.recipientId))
      ) {
        delivery.suppress("administrator_not_authorized");
      }
    } catch {
      delivery.markFailed("administrator_eligibility_unavailable");
    }
  }
}
