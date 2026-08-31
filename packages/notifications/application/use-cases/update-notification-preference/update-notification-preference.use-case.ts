import { Result } from "@architecture/foundation";

import { NotificationPreferenceEntity } from "#entities/notification-preference.entity";
import type { NotificationPreferenceRepository } from "#repositories/notification-preference.repository";
import { NotificationChannelValueObject } from "#value-objects/notification-channel.value-object";

import type {
  UpdateNotificationPreference,
  UpdateNotificationPreferenceInput,
  UpdateNotificationPreferenceOutput,
} from "./update-notification-preference.contracts.js";

export class UpdateNotificationPreferenceUseCase implements UpdateNotificationPreference {
  constructor(private readonly repository: NotificationPreferenceRepository) {}

  async execute(
    input: UpdateNotificationPreferenceInput,
  ): Promise<UpdateNotificationPreferenceOutput> {
    const channel = NotificationChannelValueObject.create(input.channel);
    if (!channel.success) {
      throw new Error(`Unsupported notification channel: ${input.channel}`);
    }
    const existing = await this.repository.find(
      input.actorUserId,
      input.channel,
    );
    const preference =
      existing ??
      NotificationPreferenceEntity.create(
        input.actorUserId,
        channel.value,
        input.enabled,
      );
    if (!existing || preference.update(input.enabled)) {
      await this.repository.save(preference);
    }
    return Result.success(undefined);
  }
}
