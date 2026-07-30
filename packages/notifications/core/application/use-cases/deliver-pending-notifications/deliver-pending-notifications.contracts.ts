import type { Result, ValueOf } from "@architecture/foundation";

import type { DeliverPendingNotificationsErrorCodes } from "./deliver-pending-notifications.codes.js";

export interface DeliverPendingNotificationsInput {
  readonly limit?: number;
}

export type DeliverPendingNotificationsError = ValueOf<
  typeof DeliverPendingNotificationsErrorCodes
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
