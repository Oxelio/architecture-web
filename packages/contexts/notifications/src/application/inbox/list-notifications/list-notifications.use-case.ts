import { Result } from "@architecture/foundation";

import type { NotificationRepository } from "#repositories/notification.repository";

import type {
  ListNotifications,
  ListNotificationsInput,
  ListNotificationsOutput,
} from "./list-notifications.contracts.js";
import { ListNotificationsErrors } from "./list-notifications.contracts.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export class ListNotificationsUseCase implements ListNotifications {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(
    input: ListNotificationsInput,
  ): Promise<ListNotificationsOutput> {
    const page = input.page ?? DEFAULT_PAGE;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isSafeInteger(page) || page < 1) {
      return Result.failure(ListNotificationsErrors.invalidPage);
    }
    if (
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      return Result.failure(ListNotificationsErrors.invalidPageSize);
    }
    const notifications = await this.repository.list(
      input.actorUserId,
      page,
      pageSize,
    );
    return Result.success(
      notifications.map((notification) => ({
        id: notification.identifier.value,
        type: notification.type,
        severity: notification.severity.value,
        title: notification.title,
        message: notification.message,
        action: notification.action,
        createdAt: notification.createdAt,
        readAt: notification.readAt,
      })),
    );
  }
}
