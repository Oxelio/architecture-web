import type { AffectedUserDeliveryEligibility } from "#application/ports/notification-recipient-directory.port";
import type {
  NotificationDeliveryEntity,
  NotificationEntity,
} from "#domain/index";

export interface ClaimedNotificationDelivery {
  readonly notification: NotificationEntity;
  readonly delivery: NotificationDeliveryEntity;
  readonly claimToken: string;
}

export interface DeliveryEligibilityClaim {
  readonly deliveryId: string;
  readonly recipientId: string;
  readonly claimToken: string;
}

export abstract class NotificationRepository {
  abstract hasConsumedEvent(sourceEventId: string): Promise<boolean>;
  /**
   * Atomically persist the complete event snapshot, including an empty selection.
   * Each recipient appears once and every aggregate belongs to sourceEventId.
   * A consumed event is a no-op; a failure persists none of the snapshot.
   */
  abstract createForEvent(
    sourceEventId: string,
    notifications: readonly NotificationEntity[],
  ): Promise<void>;
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
  abstract claimDelivery(): Promise<
    ClaimedNotificationDelivery | DeliveryEligibilityClaim | null
  >;
  abstract resolveDeliveryEligibility(
    claim: DeliveryEligibilityClaim,
    eligibility: AffectedUserDeliveryEligibility,
    dataUseDeadline?: Date,
  ): Promise<ClaimedNotificationDelivery | null>;
  abstract ownsAuthorizedDelivery(
    claim: ClaimedNotificationDelivery,
  ): Promise<boolean>;
  abstract expireDeliveryAuthorization(
    claim: ClaimedNotificationDelivery,
  ): Promise<void>;
  abstract recoverStaleDeliveries(): Promise<void>;
  abstract finalizeDelivery(
    claim: ClaimedNotificationDelivery,
  ): Promise<boolean>;
}
