import type { Result, ValueOf } from "@architecture/foundation";

export const DeliverPendingNotificationsErrors = {
  invalidLimit: { code: "notifications.invalid_delivery_limit" },
} as const;

export interface DeliverPendingNotificationsInput {
  readonly limit?: number;
}

export type DeliverPendingNotificationsError = ValueOf<
  typeof DeliverPendingNotificationsErrors
>;
export type DeliverPendingNotificationsOutput = Result<
  number,
  DeliverPendingNotificationsError
>;

export interface DeliverPendingNotifications {
  execute(
    input?: DeliverPendingNotificationsInput,
  ): Promise<DeliverPendingNotificationsOutput>;
}
