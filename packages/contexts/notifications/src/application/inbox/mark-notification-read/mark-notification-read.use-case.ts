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
    const acknowledged = await this.repository.markReadForRecipient(
      identifier.value.value,
      input.actorUserId,
    );
    if (!acknowledged) {
      return Result.failure(MarkNotificationReadErrors.notFound);
    }
    return Result.success(undefined);
  }
}
