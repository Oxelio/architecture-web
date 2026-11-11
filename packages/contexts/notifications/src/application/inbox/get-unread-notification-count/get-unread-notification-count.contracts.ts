import type { Result } from "@architecture/foundation";

export interface GetUnreadNotificationCountInput {
  readonly actorUserId: string;
}

export type GetUnreadNotificationCountOutput = Result<number, never>;

export interface GetUnreadNotificationCount {
  execute(
    input: GetUnreadNotificationCountInput,
  ): Promise<GetUnreadNotificationCountOutput>;
}
