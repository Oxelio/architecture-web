import type { Result, ValueOf } from "@architecture/foundation";

import type { NotificationAction, NotificationSeverity } from "#domain/index";

export const ListNotificationsErrors = {
  invalidPage: { code: "notifications.invalid_page" },
  invalidPageSize: { code: "notifications.invalid_page_size" },
} as const;

export interface ListNotificationsInput {
  readonly actorUserId: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NotificationListItem {
  readonly id: string;
  readonly type: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly action: NotificationAction | null;
  readonly createdAt: Date;
  readonly readAt: Date | null;
}

export type ListNotificationsError = ValueOf<typeof ListNotificationsErrors>;
export type ListNotificationsOutput = Result<
  readonly NotificationListItem[],
  ListNotificationsError
>;

export interface ListNotifications {
  execute(input: ListNotificationsInput): Promise<ListNotificationsOutput>;
}
