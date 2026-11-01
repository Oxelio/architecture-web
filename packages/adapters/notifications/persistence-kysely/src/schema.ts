import type {
  NotificationAction,
  NotificationChannelType,
  NotificationDeliveryAudience,
  NotificationDeliveryStatus,
  NotificationSeverity,
  NotificationSuppressionReason,
} from "@architecture/notifications/domain";

export interface NotificationTable {
  id: string;
  recipient_id: string;
  source_event_id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: NotificationAction | null;
  created_at: Date;
  read_at: Date | null;
  archived_at: Date | null;
}

export interface NotificationDeliveryTable {
  id: string;
  notification_id: string;
  channel: NotificationChannelType;
  destination: string;
  audience: NotificationDeliveryAudience;
  suppression_reason: NotificationSuppressionReason | null;
  status: NotificationDeliveryStatus;
  attempts: number;
  available_at: Date;
  claimed_at: Date | null;
  claim_token: string | null;
  sent_at: Date | null;
  last_error: string | null;
}

export interface NotificationPreferenceTable {
  user_id: string;
  channel: NotificationChannelType;
  enabled: boolean;
  updated_at: Date;
}

export interface NotificationDatabase {
  notification_consumptions: {
    source_event_id: string;
    consumed_at: Date;
  };
  notifications: NotificationTable;
  notification_deliveries: NotificationDeliveryTable;
  notification_preferences: NotificationPreferenceTable;
}
