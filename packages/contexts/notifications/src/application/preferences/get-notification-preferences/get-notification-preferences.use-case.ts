import { Result } from "@architecture/foundation";

import type { NotificationPreferenceRepository } from "#repositories/notification-preference.repository";

import type {
  GetNotificationPreferences,
  GetNotificationPreferencesInput,
  GetNotificationPreferencesOutput,
} from "./get-notification-preferences.contracts.js";

export class GetNotificationPreferencesUseCase implements GetNotificationPreferences {
  constructor(private readonly repository: NotificationPreferenceRepository) {}

  async execute(
    input: GetNotificationPreferencesInput,
  ): Promise<GetNotificationPreferencesOutput> {
    const preferences = await this.repository.listForRecipient(
      input.actorUserId,
    );
    return Result.success(
      preferences.map((preference) => ({
        channel: preference.channel.value,
        enabled: preference.enabled,
      })),
    );
  }
}
