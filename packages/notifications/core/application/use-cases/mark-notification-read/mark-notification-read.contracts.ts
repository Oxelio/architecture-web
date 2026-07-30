import type { Result, ValueOf } from "@architecture/foundation";

import type { MarkNotificationReadErrorCodes } from "./mark-notification-read.codes.js";

export interface MarkNotificationReadInput {
  readonly actorUserId: string;
  readonly notificationId: string;
}

export type MarkNotificationReadError = ValueOf<
  typeof MarkNotificationReadErrorCodes
>;
export type MarkNotificationReadOutput = Result<
  void,
  MarkNotificationReadError
>;

export interface MarkNotificationRead {
  execute(
    input: MarkNotificationReadInput,
  ): Promise<MarkNotificationReadOutput>;
}
