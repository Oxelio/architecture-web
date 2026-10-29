import type { Result, ValueOf } from "@architecture/foundation";

export const MarkNotificationReadErrors = {
  invalidId: { code: "notification.invalid_id" },
  notFound: { code: "notification.not_found" },
} as const;

export interface MarkNotificationReadInput {
  readonly actorUserId: string;
  readonly notificationId: string;
}

export type MarkNotificationReadError = ValueOf<
  typeof MarkNotificationReadErrors
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
