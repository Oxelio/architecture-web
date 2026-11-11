import { Result } from "@architecture/foundation";

import { NotificationIdentifierValueObject } from "#domain/index";
import type { NotificationRepository } from "#repositories/notification.repository";

import type {
  MarkNotificationRead,
  MarkNotificationReadInput,
  MarkNotificationReadOutput,
} from "./mark-notification-read.contracts.js";
import { MarkNotificationReadErrors } from "./mark-notification-read.contracts.js";

export class MarkNotificationReadUseCase implements MarkNotificationRead {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    input: MarkNotificationReadInput,
  ): Promise<MarkNotificationReadOutput> {
    const identifier = NotificationIdentifierValueObject.create(
      input.notificationId,
    );
    if (!identifier.success) {
      return Result.failure(MarkNotificationReadErrors.invalidId);
    }
    const notification = await this.repository.findByIdForRecipient(
      identifier.value.value,
      input.actorUserId,
    );
    if (!notification) {
      return Result.failure(MarkNotificationReadErrors.notFound);
    }
    if (notification.markRead()) {
      await this.repository.saveState(notification);
    }
    return Result.success(undefined);
  }
}
