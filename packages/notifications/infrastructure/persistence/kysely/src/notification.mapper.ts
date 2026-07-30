import {
  NotificationEntity,
  NotificationIdentifierValueObject,
  NotificationSeverityValueObject,
} from "@architecture/notifications/domain";
import type { Selectable } from "kysely";

import type { NotificationTable } from "./schema.js";

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
