import type { Result } from "@architecture/foundation";
import type { NotificationChannelType } from "@architecture/notifications/domain";

export interface UpdateNotificationPreferenceInput {
  readonly actorUserId: string;
  readonly channel: NotificationChannelType;
  readonly enabled: boolean;
}

export type UpdateNotificationPreferenceOutput = Result<void, never>;

export interface UpdateNotificationPreference {
  execute(
    input: UpdateNotificationPreferenceInput,
  ): Promise<UpdateNotificationPreferenceOutput>;
}
