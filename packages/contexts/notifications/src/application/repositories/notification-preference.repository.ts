import type {
  NotificationChannelType,
  NotificationPreferenceEntity,
} from "#domain/index";

export abstract class NotificationPreferenceRepository {
  abstract listForRecipient(
    recipientId: string,
  ): Promise<NotificationPreferenceEntity[]>;
  abstract find(
    recipientId: string,
    channel: NotificationChannelType,
  ): Promise<NotificationPreferenceEntity | null>;
  abstract save(preference: NotificationPreferenceEntity): Promise<void>;
}
