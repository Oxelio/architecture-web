import type { Result } from "@architecture/foundation";

export interface MarkAllNotificationsReadInput {
  readonly actorUserId: string;
}

export type MarkAllNotificationsReadOutput = Result<void, never>;

export interface MarkAllNotificationsRead {
  execute(
    input: MarkAllNotificationsReadInput,
  ): Promise<MarkAllNotificationsReadOutput>;
}
