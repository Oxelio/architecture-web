import { Result } from "@architecture/foundation";

import type { NotificationRepository } from "#repositories/notification.repository";

import type {
  GetUnreadNotificationCount,
  GetUnreadNotificationCountInput,
  GetUnreadNotificationCountOutput,
} from "./get-unread-notification-count.contracts.js";

export class GetUnreadNotificationCountUseCase implements GetUnreadNotificationCount {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    input: GetUnreadNotificationCountInput,
  ): Promise<GetUnreadNotificationCountOutput> {
    return Result.success(await this.repository.unreadCount(input.actorUserId));
  }
}
