import type { Result } from "@architecture/foundation";

import type { NotificationChannelType } from "#domain/index";

export interface GetNotificationPreferencesInput {
  readonly actorUserId: string;
}

export interface NotificationPreference {
  readonly channel: NotificationChannelType;
  readonly enabled: boolean;
}

export type GetNotificationPreferencesOutput = Result<
  readonly NotificationPreference[],
  never
>;

export interface GetNotificationPreferences {
  execute(
    input: GetNotificationPreferencesInput,
  ): Promise<GetNotificationPreferencesOutput>;
}
