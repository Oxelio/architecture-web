import { Result } from "@architecture/foundation";

import type { NotificationRepository } from "#repositories/notification.repository";

import type {
  MarkAllNotificationsRead,
  MarkAllNotificationsReadInput,
  MarkAllNotificationsReadOutput,
} from "./mark-all-notifications-read.contracts.js";

export class MarkAllNotificationsReadUseCase implements MarkAllNotificationsRead {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    input: MarkAllNotificationsReadInput,
  ): Promise<MarkAllNotificationsReadOutput> {
    await this.repository.markAllRead(input.actorUserId);
    return Result.success(undefined);
  }
}
