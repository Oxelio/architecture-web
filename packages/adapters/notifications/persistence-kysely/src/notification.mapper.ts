import type {
  NotificationDeliveryStatus,
  NotificationSeverity,
} from "@architecture/notifications/domain";
import {
  NotificationChannelValueObject,
  NotificationDeliveryEntity,
  NotificationDeliveryIdentifierValueObject,
  NotificationEntity,
  NotificationIdentifierValueObject,
  NotificationPreferenceEntity,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import type { Selectable } from "kysely";

import type {
  NotificationPreferenceTable,
  NotificationTable,
} from "./schema.js";

export interface ClaimableNotificationRow {
  readonly notification_id: string;
  readonly recipient_id: string;
  readonly source_event_id: string;
  readonly type: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly action_url: string | null;
  readonly created_at: Date;
  readonly read_at: Date | null;
  readonly archived_at: Date | null;
  readonly delivery_id: string;
  readonly channel: NotificationPreferenceTable["channel"];
  readonly destination: string;
  readonly status: NotificationDeliveryStatus;
  readonly attempts: number;
  readonly available_at: Date;
  readonly claimed_at: Date | null;
  readonly sent_at: Date | null;
  readonly last_error: string | null;
}

export function notificationRowToEntity(
  row: Selectable<NotificationTable>,
): NotificationEntity {
  const identifier = NotificationIdentifierValueObject.create(row.id);
  const severity = NotificationSeverityValueObject.create(row.severity);
  if (!identifier.success || !severity.success) {
    throw new Error("Invalid persisted notification");
  }
  return NotificationEntity.rehydrate({
    identifier: identifier.value,
    recipientId: row.recipient_id,
    sourceEventId: row.source_event_id,
    type: row.type,
    severity: severity.value,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url,
    createdAt: row.created_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
    deliveries: [],
  });
}

export function notificationPreferenceRowToEntity(
  row: NotificationPreferenceTable,
): NotificationPreferenceEntity {
  const channel = NotificationChannelValueObject.create(row.channel);
  if (!channel.success) {
    throw new Error("Invalid persisted notification preference");
  }
  return NotificationPreferenceEntity.rehydrate({
    recipientId: row.user_id,
    channel: channel.value,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  });
}

export function claimableNotificationRowToEntity(
  row: ClaimableNotificationRow,
): NotificationEntity {
  const notificationIdentifier = NotificationIdentifierValueObject.create(
    row.notification_id,
  );
  const deliveryIdentifier = NotificationDeliveryIdentifierValueObject.create(
    row.delivery_id,
  );
  const channel = NotificationChannelValueObject.create(row.channel);
  const severity = NotificationSeverityValueObject.create(row.severity);
  if (
    !notificationIdentifier.success ||
    !deliveryIdentifier.success ||
    !channel.success ||
    !severity.success
  ) {
    throw new Error("Invalid persisted claimable notification");
  }
  const delivery = NotificationDeliveryEntity.rehydrate({
    identifier: deliveryIdentifier.value,
    channel: channel.value,
    destination: row.destination,
    status: row.status,
    attempts: row.attempts,
    availableAt: row.available_at,
    claimedAt: row.claimed_at,
    sentAt: row.sent_at,
    lastError: row.last_error,
  });
  return NotificationEntity.rehydrate({
    identifier: notificationIdentifier.value,
    recipientId: row.recipient_id,
    sourceEventId: row.source_event_id,
    type: row.type,
    severity: severity.value,
    title: row.title,
    message: row.message,
    actionUrl: row.action_url,
    createdAt: row.created_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
    deliveries: [delivery],
  });
}
